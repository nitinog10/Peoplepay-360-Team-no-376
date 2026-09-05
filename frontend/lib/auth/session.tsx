"use client";

/**
 * Session state for the whole app: who is signed in, what they may do, and the
 * login/logout transitions.
 *
 * It is a TanStack query rather than a `useState` + effect so the bootstrap has
 * loading/error states for free, and so `queryClient.setQueryData` can update it
 * from a mutation without a second source of truth.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo } from "react";

import { api, onSessionEnded } from "@/lib/api";
import type { LoginBody, Permission, RoleName, SessionUser } from "@/lib/api/types";

export const sessionKey = ["session"] as const;

export type SessionStatus = "loading" | "authenticated" | "anonymous" | "error";

export interface SessionValue {
  status: SessionStatus;
  user: SessionUser | null;
  role: RoleName | null;
  permissions: readonly Permission[];
  /** True when the signed-in user holds `permission`. */
  can: (permission: Permission) => boolean;
  /** True when they hold at least one of `permissions` — how nav sections gate. */
  canAny: (permissions: readonly Permission[]) => boolean;
  /** Why the bootstrap failed (server unreachable, CORS, 500) — not a 401. */
  error: Error | null;
  retry: () => void;
  login: (body: LoginBody) => Promise<SessionUser>;
  isLoggingIn: boolean;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Where to send someone after they sign in, from the URL they were denied. */
function nextParam(): string {
  if (typeof window === "undefined") return "/";
  const { pathname, search } = window.location;
  return pathname === "/login" ? "/" : pathname + search;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const session = useQuery({
    queryKey: sessionKey,
    // Trades the refresh cookie for a token, then reads the user. `null` = anonymous.
    queryFn: () => api.auth.restore(),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // The client calls this when a refresh fails mid-session. Flipping the session
  // to null unmounts the guarded tree, which takes its in-flight queries with it.
  useEffect(
    () =>
      onSessionEnded(() => {
        const next = nextParam();
        queryClient.setQueryData(sessionKey, null);
        router.replace(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
      }),
    [queryClient, router],
  );

  const loginMutation = useMutation({
    mutationFn: (body: LoginBody) => api.auth.login(body),
    onSuccess: (result) => {
      // Only safe place to wipe the cache: the login screen observes nothing else,
      // so no leftover row from the previous user can be re-rendered or refetched.
      queryClient.clear();
      queryClient.setQueryData(sessionKey, result.user);
    },
  });

  const login = useCallback(
    async (body: LoginBody) => (await loginMutation.mutateAsync(body)).user,
    [loginMutation],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      queryClient.setQueryData(sessionKey, null);
      router.replace("/login");
    }
  }, [queryClient, router]);

  const user = session.data ?? null;
  const permissions = useMemo(() => user?.permissions ?? [], [user]);

  const can = useCallback(
    (permission: Permission) => permissions.includes(permission),
    [permissions],
  );
  const canAny = useCallback(
    (wanted: readonly Permission[]) => wanted.some((p) => permissions.includes(p)),
    [permissions],
  );

  const status: SessionStatus = session.isPending
    ? "loading"
    : session.isError
      ? "error"
      : user
        ? "authenticated"
        : "anonymous";

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      role: user?.role ?? null,
      permissions,
      can,
      canAny,
      error: session.error,
      retry: () => void session.refetch(),
      login,
      isLoggingIn: loginMutation.isPending,
      logout,
    }),
    [status, user, permissions, can, canAny, session, login, loginMutation.isPending, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>.");
  return value;
}
