/**
 * The single fetch wrapper every screen goes through.
 *
 * Auth model: the access token lives in memory only — never `localStorage`, never
 * a cookie this origin can read — so a script injection cannot lift a credential
 * that outlives the tab. Durability comes from the httpOnly `pp360_refresh`
 * cookie the API sets on `/api/v1/auth`. :3000 and :8000 are cross-origin but
 * same-site (a port is not part of a site), so that `SameSite=Lax` cookie still
 * rides along on `credentials: "include"` requests.
 *
 * On a 401 the wrapper runs one refresh on behalf of every waiting caller
 * (single flight) and retries the request once. A failed refresh — or a second
 * 401 after a successful one — ends the session and sends the user to /login.
 */

import type {
  ApiErrorCode,
  AuthSession,
  LoginBody,
  SessionUser,
  ValidationDetail,
} from "./types";

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Copy frontend/.env.example to .env.local.",
    );
  }
  return url.replace(/\/+$/, "");
}

// ---------- errors ----------

/** `status` 0 means the request never reached the API. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | "NETWORK_ERROR",
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Project API validation/conflict details onto RHF field names. */
  fieldErrors(fields: readonly string[] = []): Record<string, string> {
    const out: Record<string, string> = {};
    if (this.code === "VALIDATION_ERROR" && Array.isArray(this.details)) {
      for (const issue of this.details as ValidationDetail[]) {
        if (issue?.path && !(issue.path in out)) out[issue.path] = issue.message;
      }
      return out;
    }
    if (this.details && typeof this.details === "object" && !Array.isArray(this.details)) {
      for (const field of fields) {
        const message = (this.details as Record<string, unknown>)[field];
        if (typeof message === "string") out[field] = message;
      }
      if (Object.keys(out).length > 0) return out;
    }
    if (this.code === "UNIQUE_VIOLATION") {
      const field = this.uniqueField(fields);
      if (field) out[field] = this.message;
    }
    return out;
  }

  /** Which of `fields` the violated unique index names, if any. */
  uniqueField(fields: readonly string[]): string | undefined {
    const target = (this.details as { target?: unknown } | undefined)?.target;
    if (typeof target !== "string") return undefined;
    const index = target.replace(/_(key|unique|idx)$/, "");
    return fields.find((field) => index.endsWith(toSnakeCase(field)));
  }
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

// ---------- session state ----------

let accessToken: string | null = null;

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

type Listener = () => void;
const sessionEndedListeners = new Set<Listener>();

/**
 * Called when the session is over and cannot be recovered. `SessionProvider`
 * subscribes so it can clear its cache and route to /login with the router;
 * without a subscriber this falls back to a hard navigation.
 */
export function onSessionEnded(listener: Listener): () => void {
  sessionEndedListeners.add(listener);
  return () => sessionEndedListeners.delete(listener);
}

function endSession(): void {
  accessToken = null;
  if (sessionEndedListeners.size > 0) {
    for (const listener of [...sessionEndedListeners]) listener();
    return;
  }
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  if (pathname === "/login") return;
  // Deliberately a hard navigation, not `router.push`: this branch only runs when no
  // provider is mounted to hear the event, so there is no React tree to route with —
  // and a full reload is the surest way to drop the dead session's in-memory state.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${encodeURIComponent(pathname + search)}`);
}

// ---------- requests ----------

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /** Opt out of the 401 → refresh → retry cycle (the auth calls themselves do). */
  noRetry?: boolean;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return `${baseUrl()}${path}${qs ? `?${qs}` : ""}`;
}

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const envelope = body as
    | { error?: { code?: string; message?: string; details?: unknown } }
    | undefined;
  const error = envelope?.error;
  return new ApiError(
    status,
    (error?.code as ApiErrorCode) ?? "INTERNAL_ERROR",
    error?.message ?? `Request failed with status ${status}`,
    error?.details,
  );
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // Carries the refresh cookie; harmless on every other call.
      credentials: "include",
      cache: "no-store",
      signal: options.signal,
    });
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server.", cause);
  }
}

async function responseWithRefresh(path: string, options: RequestOptions): Promise<Response> {
  let res = await send(path, options);

  if (res.status === 401 && !options.noRetry) {
    if (!(await tryRefresh())) {
      const body = await readBody(res);
      endSession();
      throw toApiError(401, body);
    }
    res = await send(path, { ...options, noRetry: true });
    if (res.status === 401) {
      const body = await readBody(res);
      // A fresh token that is still rejected: deactivated, or deleted mid-session.
      endSession();
      throw toApiError(401, body);
    }
  }
  return res;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const res = await responseWithRefresh(path, options);
  const body = await readBody(res);
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

export interface DownloadedFile {
  blob: Blob;
  filename: string | null;
  contentType: string | null;
}

/** Authenticated binary response with the same single-flight refresh path as JSON. */
export async function download(
  path: string,
  options: Omit<RequestOptions, "method" | "body"> = {},
): Promise<DownloadedFile> {
  const res = await responseWithRefresh(path, { ...options, method: "GET" });
  if (!res.ok) throw toApiError(res.status, await readBody(res));
  const disposition = res.headers.get("content-disposition");
  const filename = disposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? null;
  return { blob: await res.blob(), filename, contentType: res.headers.get("content-type") };
}

export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body: body ?? {} }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body: body ?? {} }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),
  download,
};

// ---------- auth ----------

let refreshInFlight: Promise<AuthSession> | null = null;

/**
 * Exchanges the refresh cookie for a new access token. Rotating: the presented
 * token is revoked server-side, so two parallel refreshes would race and one
 * would lose its cookie — hence the single flight.
 */
export function refreshSession(): Promise<AuthSession> {
  refreshInFlight ??= request<AuthSession>("/auth/refresh", {
    method: "POST",
    body: {},
    noRetry: true,
  })
    .then((session) => {
      accessToken = session.accessToken;
      return session;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function tryRefresh(): Promise<boolean> {
  try {
    await refreshSession();
    return true;
  } catch {
    return false;
  }
}

export const auth = {
  async login(body: LoginBody): Promise<AuthSession> {
    const session = await request<AuthSession>("/auth/login", {
      method: "POST",
      body,
      noRetry: true,
    });
    accessToken = session.accessToken;
    return session;
  },

  me: (options?: Omit<RequestOptions, "method" | "body">) =>
    request<SessionUser>("/auth/me", options),

  async logout(): Promise<void> {
    try {
      await request<void>("/auth/logout", { method: "POST", body: {}, noRetry: true });
    } finally {
      // Even if the call fails the local half of the session must go.
      accessToken = null;
    }
  },

  /**
   * Startup: the cookie survives a reload but the in-memory token does not, so
   * trade the cookie for a token and then read the user.
   *
   * A 401 means "not signed in". Anything else (server down, CORS misconfigured)
   * is surfaced so the UI can say so instead of pretending the user is anonymous.
   */
  async restore(): Promise<SessionUser | null> {
    try {
      await refreshSession();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
    return request<SessionUser>("/auth/me", { noRetry: true });
  },
};
