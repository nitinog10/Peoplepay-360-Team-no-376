/**
 * Permission catalogue and employee scoping. `scopeToEmployee` is the single
 * gate that keeps an EMPLOYEE inside their own records, so both the allow and
 * the deny path are asserted here.
 */
import { describe, expect, it } from 'vitest';
import type { RoleName } from '../generated/prisma/enums';
import { ForbiddenError } from '../lib/errors';
import type { Actor } from '../lib/security';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  canSeeAllEmployees,
  hasPermission,
  permissionsFor,
  requireEmployeeScope,
  scopeToEmployee,
} from './permissions';

const hr: Actor = { userId: 1, employeeId: 1, role: 'HR_MANAGER', username: 'hr.manager' };
const payroll: Actor = { userId: 3, employeeId: 3, role: 'HR_PAYROLL_USER', username: 'payroll.user' };
const payrollManager: Actor = { userId: 4, employeeId: 4, role: 'HR_PAYROLL_MANAGER', username: 'payroll.manager' };
const admin: Actor = { userId: 5, employeeId: 5, role: 'ADMIN', username: 'admin' };
const employee: Actor = { userId: 2, employeeId: 7, role: 'EMPLOYEE', username: 'aarav.mehta@oxp.com' };

const PAYROLL_USER_PERMISSIONS = ['payroll:read', 'payruns:write', 'payslips:write', 'salary-config:read'] as const;
const PAYROLL_MANAGER_PERMISSIONS = ['salary-config:write', 'payruns:delete', 'payslips:delete'] as const;
const ADMIN_ONLY_PERMISSIONS = ['roles:read'] as const;

describe('role catalogue', () => {
  it('keeps HR_MANAGER on the explicit HR permission set without payroll or admin access', () => {
    expect(permissionsFor('HR_MANAGER')).toHaveLength(
      PERMISSIONS.length - PAYROLL_USER_PERMISSIONS.length - PAYROLL_MANAGER_PERMISSIONS.length - ADMIN_ONLY_PERMISSIONS.length,
    );
    for (const permission of [...PAYROLL_USER_PERMISSIONS, ...PAYROLL_MANAGER_PERMISSIONS, ...ADMIN_ONLY_PERMISSIONS]) {
      expect(hasPermission('HR_MANAGER', permission)).toBe(false);
    }
  });

  it('makes HR_PAYROLL_USER the HR_MANAGER superset without manager-only or admin-only access', () => {
    expect(permissionsFor('HR_PAYROLL_USER')).toHaveLength(
      PERMISSIONS.length - PAYROLL_MANAGER_PERMISSIONS.length - ADMIN_ONLY_PERMISSIONS.length,
    );
    for (const permission of PAYROLL_USER_PERMISSIONS) expect(hasPermission('HR_PAYROLL_USER', permission)).toBe(true);
    for (const permission of [...PAYROLL_MANAGER_PERMISSIONS, ...ADMIN_ONLY_PERMISSIONS]) {
      expect(hasPermission('HR_PAYROLL_USER', permission)).toBe(false);
    }
  });

  it('makes HR_PAYROLL_MANAGER the payroll-user superset without admin-only access', () => {
    expect(permissionsFor('HR_PAYROLL_MANAGER')).toHaveLength(PERMISSIONS.length - ADMIN_ONLY_PERMISSIONS.length);
    for (const permission of PERMISSIONS.filter((candidate) => candidate !== 'roles:read')) {
      expect(hasPermission('HR_PAYROLL_MANAGER', permission)).toBe(true);
    }
    for (const permission of ADMIN_ONLY_PERMISSIONS) expect(hasPermission('HR_PAYROLL_MANAGER', permission)).toBe(false);
  });

  it('gives ADMIN every catalogue permission', () => {
    expect(permissionsFor('ADMIN')).toHaveLength(PERMISSIONS.length);
    for (const permission of PERMISSIONS) expect(hasPermission('ADMIN', permission)).toBe(true);
  });

  it('gives EMPLOYEE reads plus self-service only', () => {
    for (const p of ['attendance:punch', 'time-off:request', 'employees:read', 'leave-balances:read'] as const) {
      expect(hasPermission('EMPLOYEE', p)).toBe(true);
    }
  });

  it('withholds every write and decision permission from EMPLOYEE', () => {
    const denied = [
      'users:manage',
      'departments:write',
      'leave-types:write',
      'work-schedules:write',
      'employees:write',
      'contracts:write',
      'attendance:write',
      'leave-balances:write',
      'time-off:decide',
      'payroll:read',
      'payruns:write',
      'payslips:write',
      'salary-config:read',
    ] as const;
    for (const p of denied) expect(hasPermission('EMPLOYEE', p)).toBe(false);
    // Guards against a write permission being added to PERMISSIONS and quietly
    // landing in the EMPLOYEE set: every permission EMPLOYEE holds is a read,
    // a punch or a request.
    for (const p of permissionsFor('EMPLOYEE')) {
      expect(p).toMatch(/:(read|punch|request)$/);
    }
  });

  it('exposes each role as a set, and refuses an unknown role', () => {
    expect(ROLE_PERMISSIONS.EMPLOYEE.has('employees:read')).toBe(true);
    expect(hasPermission('SUPER_ADMIN' as RoleName, 'employees:read')).toBe(false);
    expect(permissionsFor('SUPER_ADMIN' as RoleName)).toEqual([]);
  });
});

describe('canSeeAllEmployees', () => {
  it('is true for every released HR-capable role and ADMIN, and false for EMPLOYEE', () => {
    expect(canSeeAllEmployees(hr)).toBe(true);
    expect(canSeeAllEmployees(payroll)).toBe(true);
    expect(canSeeAllEmployees(payrollManager)).toBe(true);
    expect(canSeeAllEmployees(admin)).toBe(true);
    expect(canSeeAllEmployees(employee)).toBe(false);
  });
});

describe('scopeToEmployee', () => {
  it('lets HR_MANAGER and ADMIN through unrestricted', () => {
    expect(scopeToEmployee(hr, 42)).toBe(42);
    expect(scopeToEmployee(hr, undefined)).toBeUndefined(); // no filter → all employees
    expect(scopeToEmployee(admin, 42)).toBe(42);
    expect(scopeToEmployee(admin, undefined)).toBeUndefined();
  });

  it('pins EMPLOYEE to their own record', () => {
    expect(scopeToEmployee(employee, 7)).toBe(7);
    expect(scopeToEmployee(employee, undefined)).toBe(7); // an omitted id is not a wildcard
  });

  it('refuses EMPLOYEE asking for someone else', () => {
    expect(() => scopeToEmployee(employee, 8)).toThrow(ForbiddenError);
    try {
      scopeToEmployee(employee, 8);
      expect.unreachable('scopeToEmployee should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).status).toBe(403);
      expect((err as ForbiddenError).message).toBe('You can only access your own records');
    }
  });
});

describe('requireEmployeeScope', () => {
  it('always yields a concrete employee id', () => {
    expect(requireEmployeeScope(employee, undefined)).toBe(7);
    expect(requireEmployeeScope(hr, 42)).toBe(42);
  });

  it('refuses HR_MANAGER without an employee id', () => {
    expect(() => requireEmployeeScope(hr, undefined)).toThrow(/employeeId is required/);
  });

  it('still refuses EMPLOYEE reaching for another record', () => {
    expect(() => requireEmployeeScope(employee, 8)).toThrow(ForbiddenError);
  });
});
