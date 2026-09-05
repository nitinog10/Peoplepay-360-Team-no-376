"use client";

import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";

import { Forbidden, isForbidden } from "@/components/forbidden";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";

/**
 * Error boundary for every authenticated screen. It sits inside `(app)/layout.tsx`,
 * so the shell survives the error and the user can navigate away.
 *
 * A 403 gets the readable permission screen; anything else gets the message and a
 * retry, because most other failures here are "the API is down" rather than "you
 * may not do that".
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (isForbidden(error)) return <Forbidden />;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlertIcon className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          {error instanceof ApiError ? error.message : "This screen failed to load."}
        </p>
      </div>
      <Button variant="outline" onClick={reset}>
        <RefreshCwIcon /> Try again
      </Button>
    </div>
  );
}
