"use client";

import { ShieldAlertIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/use-can";
import { ApiError, type Permission } from "@/lib/api";

/** True for the one error shape that should render `<Forbidden />` instead of a retry. */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/** One permission or a list, always as a list. `typeof` narrows where `Array.isArray` won't (readonly arrays). */
function asList(permission: Permission | readonly Permission[]): readonly Permission[] {
  return typeof permission === "string" ? [permission] : permission;
}

/**
 * The 403 screen. Reached two ways: `RequirePermission` refuses to render a page,
 * or a query comes back `ApiError.status === 403` and the caller checks
 * `isForbidden(error)`.
 */
export function Forbidden({
  title = "You don't have access to this page",
  description = "Your account doesn't carry the permission this screen needs. If that looks wrong, ask an HR manager to check your role.",
  permission,
}: {
  title?: string;
  description?: string;
  permission?: Permission | readonly Permission[];
}) {
  const needed = permission ? asList(permission).join(" or ") : undefined;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlertIcon className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        {needed && (
          <p className="text-xs text-muted-foreground">
            Requires <code>{needed}</code>.
          </p>
        )}
      </div>
      <Button asChild variant="outline">
        <Link href="/">Back to My Space</Link>
      </Button>
    </div>
  );
}

/**
 * Route-level permission gate.
 *
 * This exists because the API is not a sufficient guard on its own: `departments:read`
 * is granted to EMPLOYEE, so `/departments` would answer 200 with rows an employee has
 * no business managing. HR-only screens therefore gate on the `:write` permission here,
 * in the UI, and the server still enforces the write itself.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission | readonly Permission[];
  children: React.ReactNode;
}) {
  const { canAny } = useCan();
  return canAny(asList(permission)) ? <>{children}</> : <Forbidden permission={permission} />;
}
