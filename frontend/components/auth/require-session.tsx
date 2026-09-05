"use client";

/**
 * Route guard for everything behind a login. Anonymous visitors are sent to
 * /login with a `next` hop; a failed bootstrap gets a retry instead, because
 * "the API is down" and "you are signed out" deserve different screens.
 *
 * The redirect target is read from `window.location` inside the effect rather
 * than with `useSearchParams()`, which would force this subtree into a Suspense
 * boundary at build time for a value only the browser ever needs.
 */

import { LoaderCircleIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session";

export function RequireSession({ children }: { children: React.ReactNode }) {
  const { status, error, retry } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "anonymous") return;
    const { pathname, search } = window.location;
    const next = pathname + search;
    router.replace(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
  }, [status, router]);

  if (status === "loading") {
    return (
      <div
        role="status"
        aria-label="Restoring your session"
        className="flex flex-1 items-center justify-center p-12"
      >
        <LoaderCircleIcon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
        <TriangleAlertIcon className="size-8 text-warning" />
        <h1 className="font-heading text-lg font-semibold">Cannot reach the server</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error?.message ?? "The API did not respond."} Check that the API is
          running on the address in <code className="font-mono">NEXT_PUBLIC_API_URL</code>.
        </p>
        <Button variant="outline" onClick={retry}>
          <RefreshCwIcon /> Try again
        </Button>
      </div>
    );
  }

  // Anonymous: the redirect above is already in flight, so render nothing.
  if (status === "anonymous") return null;

  return children;
}
