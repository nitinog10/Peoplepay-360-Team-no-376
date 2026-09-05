import type { RoleName } from '../generated/prisma/enums';
import { ForbiddenError } from '../lib/errors';
import type { Actor } from '../lib/security';

/**
 * Permission catalogue. `*:read` for EMPLOYEE means "own records only"; the
 * scoping itself is applied in services via `scopeToEmployee()`.
 */
export const PERMISSIONS = [
  'users:manage',
  'departments:read',
  'departments:write',
  'leave-types:read',
  'leave-types:write',
  'work-schedules:read',
  'work-schedules:write',
  'employees:read',
  'employees:write',
  'contracts:read',
  'contracts:write',
  'attendance:read',
  'attendance:punch',
  'attendance:write',
  'leave-balances:read',
  'leave-balances:write',
  'time-off:read',
  'time-off:request',
  'time-off:decide',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const HR_MANAGER: Permission[] = [...PERMISSIONS];

const EMPLOYEE: Permission[] = [
  'departments:read',
  'leave-types:read',
  'work-schedules:read',
  'employees:read',
  'contracts:read',
  'attendance:read',
  'attendance:punch',
  'leave-balances:read',
  'time-off:read',
  'time-off:request',
];

export const ROLE_PERMISSIONS: Record<RoleName, ReadonlySet<Permission>> = {
  EMPLOYEE: new Set(EMPLOYEE),
  HR_MANAGER: new Set(HR_MANAGER),
};

export function hasPermission(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function permissionsFor(role: RoleName): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

/** Roles whose reads are not restricted to their own employee record. */
export function canSeeAllEmployees(actor: Actor): boolean {
  return actor.role === 'HR_MANAGER';
}

/**
 * Resolve which employee's data a request may touch.
 *  - HR_MANAGER: any employee (`requested` may be undefined → no restriction).
 *  - EMPLOYEE: only their own; asking for someone else is forbidden.
 */
export function scopeToEmployee(actor: Actor, requested?: number): number | undefined {
  if (canSeeAllEmployees(actor)) return requested;
  if (requested !== undefined && requested !== actor.employeeId) {
    throw new ForbiddenError('You can only access your own records');
  }
  return actor.employeeId;
}

/** Same as scopeToEmployee but always yields a concrete employee id. */
export function requireEmployeeScope(actor: Actor, requested?: number): number {
  const id = scopeToEmployee(actor, requested);
  if (id === undefined) throw new ForbiddenError('employeeId is required');
  return id;
}
