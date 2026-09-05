"use client";

import { useSession } from "@/lib/auth/session";
import type { Permission } from "@/lib/api/types";

/**
 * Permission checks without pulling the whole session in.
 *
 * `can` takes one permission, `canAny` a list (a nav section is visible when any
 * of its children are). Note that `*:read` is granted to employees too — the API
 * scopes their rows instead of refusing — so an HR-only screen must gate on the
 * matching `:write` permission.
 */
export function useCan(): {
  can: (permission: Permission) => boolean;
  canAny: (permissions: readonly Permission[]) => boolean;
  isHr: boolean;
} {
  const { can, canAny, role } = useSession();
  return { can, canAny, isHr: role === "HR_MANAGER" };
}
