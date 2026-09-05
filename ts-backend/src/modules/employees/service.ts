import { canSeeAllEmployees, scopeToEmployee } from '../../auth/permissions';
import type { Prisma } from '../../generated/prisma/client';
import { addDays, todayLocal } from '../../lib/dates';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type { Actor } from '../../lib/security';
import { resolveScheduleFor } from '../work-schedules/resolve';
import { presentSchedule } from '../work-schedules/service';
import type {
  CreateAssignmentInput,
  CreateEmployeeInput,
  ListEmployeesQuery,
  TerminateEmployeeInput,
  UpdateAssignmentInput,
  UpdateEmployeeInput,
} from './schema';

const include = {
  department: { select: { departmentId: true, departmentName: true } },
  manager: { select: { employeeId: true, firstName: true, lastName: true, email: true } },
  user: { select: { userId: true, username: true, isActive: true, role: { select: { roleName: true } } } },
} as const;

type EmployeeRow = Prisma.EmployeeGetPayload<{ include: typeof include }>;

function present(e: EmployeeRow) {
  const { user, ...rest } = e;
  return {
    ...rest,
    fullName: `${e.firstName} ${e.lastName}`,
    user: user ? { userId: user.userId, username: user.username, isActive: user.isActive, role: user.role.roleName } : null,
  };
}

async function assertDepartment(departmentId: number | null | undefined) {
  if (departmentId == null) return;
  const d = await prisma.department.findUnique({ where: { departmentId } });
  if (!d) throw new NotFoundError('Department', departmentId);
}

async function assertManager(managerId: number | null | undefined, selfId?: number) {
  if (managerId == null) return;
  if (selfId !== undefined && managerId === selfId) throw new BusinessRuleError('An employee cannot be their own manager');
  const m = await prisma.employee.findUnique({ where: { employeeId: managerId } });
  if (!m) throw new NotFoundError('Manager (employee)', managerId);
  if (m.status === 'TERMINATED') throw new BusinessRuleError('Manager is a terminated employee');
}

export async function list(actor: Actor, query: ListEmployeesQuery) {
  const own = scopeToEmployee(actor);
  const where: Prisma.EmployeeWhereInput = {
    ...(own !== undefined ? { employeeId: own } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.managerId ? { managerId: query.managerId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { firstName: { contains: query.q } },
            { lastName: { contains: query.q } },
            { email: { contains: query.q } },
            { jobTitle: { contains: query.q } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include,
      ...toSkipTake(query),
      orderBy: toOrderBy(
        query,
        ['employeeId', 'firstName', 'lastName', 'email', 'hireDate', 'status', 'jobTitle'] as const,
        'lastName',
      ),
    }),
    prisma.employee.count({ where }),
  ]);
  return listResponse(rows.map(present), total, query);
}

async function findOrThrow(employeeId: number): Promise<EmployeeRow> {
  const e = await prisma.employee.findUnique({ where: { employeeId }, include });
  if (!e) throw new NotFoundError('Employee', employeeId);
  return e;
}

export async function get(actor: Actor, employeeId: number) {
  scopeToEmployee(actor, employeeId);
  return present(await findOrThrow(employeeId));
}

export async function me(actor: Actor) {
  return present(await findOrThrow(actor.employeeId));
}

export async function create(input: CreateEmployeeInput) {
  await assertDepartment(input.departmentId);
  await assertManager(input.managerId);
  const data: Prisma.EmployeeUncheckedCreateInput = { ...input };
  if (input.status === 'TERMINATED' && !input.terminationDate) data.terminationDate = todayLocal();
  return present(await prisma.employee.create({ data, include }));
}

export async function update(employeeId: number, input: UpdateEmployeeInput) {
  const existing = await findOrThrow(employeeId);
  await assertDepartment(input.departmentId);
  await assertManager(input.managerId, employeeId);

  const data: Prisma.EmployeeUncheckedUpdateInput = { ...input };
  if (input.status === 'TERMINATED' && !input.terminationDate && !existing.terminationDate) {
    data.terminationDate = todayLocal();
  }
  const updated = await prisma.employee.update({ where: { employeeId }, data, include });

  if (input.status && input.status !== 'ACTIVE' && existing.user) {
    await deactivateLogin(existing.user.userId);
  }
  return present(updated);
}

async function deactivateLogin(userId: number) {
  await prisma.$transaction([
    prisma.user.update({ where: { userId }, data: { isActive: false } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function terminate(actor: Actor, employeeId: number, input: TerminateEmployeeInput) {
  if (employeeId === actor.employeeId) throw new BusinessRuleError('You cannot terminate your own employee record');
  const existing = await findOrThrow(employeeId);
  if (existing.status === 'TERMINATED') throw new ConflictError('Employee is already terminated');
  const terminationDate = input.terminationDate ?? todayLocal();
  if (terminationDate.getTime() < existing.hireDate.getTime()) {
    throw new BusinessRuleError('terminationDate cannot be before hireDate');
  }
  const updated = await prisma.$transaction(async (tx) => {
    const e = await tx.employee.update({
      where: { employeeId },
      data: { status: 'TERMINATED', terminationDate },
      include,
    });
    // Close open contracts and schedule assignments as of the termination date.
    await tx.contract.updateMany({
      where: { employeeId, status: 'ACTIVE' },
      data: { status: 'TERMINATED', endDate: terminationDate },
    });
    await tx.employeeScheduleAssignment.updateMany({
      where: { employeeId, effectiveTo: null },
      data: { effectiveTo: terminationDate },
    });
    if (e.user) {
      await tx.user.update({ where: { userId: e.user.userId }, data: { isActive: false } });
      await tx.refreshToken.updateMany({ where: { userId: e.user.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return e;
  });
  return present(updated);
}

/** Hard delete. The schema cascades to the employee's user, contracts, attendance, balances and requests. */
export async function remove(actor: Actor, employeeId: number) {
  if (employeeId === actor.employeeId) throw new BusinessRuleError('You cannot delete your own employee record');
  await findOrThrow(employeeId);
  const reports = await prisma.employee.count({ where: { managerId: employeeId } });
  if (reports > 0) throw new BusinessRuleError(`Employee manages ${reports} other employee(s); reassign them first`);
  await prisma.employee.delete({ where: { employeeId } });
}

export async function summary(actor: Actor, employeeId: number) {
  scopeToEmployee(actor, employeeId);
  const today = todayLocal();
  const [employee, contracts, attendance, requests, pendingRequests, balances, activeContract, schedule, reports] =
    await Promise.all([
      findOrThrow(employeeId),
      prisma.contract.count({ where: { employeeId } }),
      prisma.attendanceRecord.count({ where: { employeeId } }),
      prisma.timeOffRequest.count({ where: { employeeId } }),
      prisma.timeOffRequest.count({ where: { employeeId, status: 'PENDING' } }),
      prisma.leaveBalance.count({ where: { employeeId, year: today.getUTCFullYear() } }),
      prisma.contract.findFirst({
        where: {
          employeeId,
          status: 'ACTIVE',
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }],
        },
        orderBy: { startDate: 'desc' },
      }),
      resolveScheduleFor(employeeId, today),
      prisma.employee.count({ where: { managerId: employeeId } }),
    ]);
  return {
    employee: present(employee),
    counts: { contracts, attendance, timeOffRequests: requests, pendingTimeOffRequests: pendingRequests, leaveBalances: balances, directReports: reports },
    activeContract,
    currentSchedule: schedule ? presentSchedule(schedule) : null,
  };
}

// ---------- schedule assignments ----------

const assignmentInclude = { schedule: true } as const;

function presentAssignment(a: Prisma.EmployeeScheduleAssignmentGetPayload<{ include: typeof assignmentInclude }>) {
  const { schedule, ...rest } = a;
  return { ...rest, schedule: presentSchedule(schedule) };
}

export async function listAssignments(actor: Actor, employeeId: number) {
  scopeToEmployee(actor, employeeId);
  await findOrThrow(employeeId);
  const rows = await prisma.employeeScheduleAssignment.findMany({
    where: { employeeId },
    include: assignmentInclude,
    orderBy: { effectiveFrom: 'desc' },
  });
  return { data: rows.map(presentAssignment) };
}

export async function mySchedule(actor: Actor) {
  const today = todayLocal();
  const assignment = await prisma.employeeScheduleAssignment.findFirst({
    where: { employeeId: actor.employeeId, effectiveFrom: { lte: today }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }] },
    orderBy: { effectiveFrom: 'desc' },
    include: assignmentInclude,
  });
  return assignment ? presentAssignment(assignment) : null;
}

const FAR_FUTURE = new Date('9999-12-31T00:00:00.000Z');

async function overlappingAssignments(employeeId: number, from: Date, to: Date | null, excludeId?: number) {
  return prisma.employeeScheduleAssignment.findMany({
    where: {
      employeeId,
      ...(excludeId ? { assignmentId: { not: excludeId } } : {}),
      effectiveFrom: { lte: to ?? FAR_FUTURE },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
    },
  });
}

export async function createAssignment(employeeId: number, input: CreateAssignmentInput) {
  const employee = await findOrThrow(employeeId);
  if (employee.status === 'TERMINATED') throw new BusinessRuleError('Cannot assign a schedule to a terminated employee');
  const schedule = await prisma.workSchedule.findUnique({ where: { scheduleId: input.scheduleId } });
  if (!schedule) throw new NotFoundError('Work schedule', input.scheduleId);

  const to = input.effectiveTo ?? null;
  const overlaps = await overlappingAssignments(employeeId, input.effectiveFrom, to);

  const closable = overlaps.filter((o) => o.effectiveTo === null && o.effectiveFrom.getTime() < input.effectiveFrom.getTime());
  const blocking = overlaps.filter((o) => !closable.includes(o));
  if (blocking.length > 0 || (!input.closePrevious && overlaps.length > 0)) {
    throw new ConflictError('Schedule assignment overlaps an existing assignment', {
      conflicts: overlaps.map((o) => ({ assignmentId: o.assignmentId, effectiveFrom: o.effectiveFrom, effectiveTo: o.effectiveTo })),
    });
  }

  const created = await prisma.$transaction(async (tx) => {
    for (const prev of closable) {
      await tx.employeeScheduleAssignment.update({
        where: { assignmentId: prev.assignmentId },
        data: { effectiveTo: addDays(input.effectiveFrom, -1) },
      });
    }
    return tx.employeeScheduleAssignment.create({
      data: { employeeId, scheduleId: input.scheduleId, effectiveFrom: input.effectiveFrom, effectiveTo: to },
      include: assignmentInclude,
    });
  });
  return presentAssignment(created);
}

export async function updateAssignment(assignmentId: number, input: UpdateAssignmentInput) {
  const existing = await prisma.employeeScheduleAssignment.findUnique({ where: { assignmentId } });
  if (!existing) throw new NotFoundError('Schedule assignment', assignmentId);
  if (input.scheduleId) {
    const s = await prisma.workSchedule.findUnique({ where: { scheduleId: input.scheduleId } });
    if (!s) throw new NotFoundError('Work schedule', input.scheduleId);
  }
  const from = input.effectiveFrom ?? existing.effectiveFrom;
  const to = input.effectiveTo === undefined ? existing.effectiveTo : input.effectiveTo;
  if (to && to.getTime() < from.getTime()) throw new BusinessRuleError('effectiveTo must be on or after effectiveFrom');

  const overlaps = await overlappingAssignments(existing.employeeId, from, to, assignmentId);
  if (overlaps.length > 0) {
    throw new ConflictError('Schedule assignment overlaps an existing assignment', {
      conflicts: overlaps.map((o) => ({ assignmentId: o.assignmentId, effectiveFrom: o.effectiveFrom, effectiveTo: o.effectiveTo })),
    });
  }
  const updated = await prisma.employeeScheduleAssignment.update({
    where: { assignmentId },
    data: { ...(input.scheduleId ? { scheduleId: input.scheduleId } : {}), effectiveFrom: from, effectiveTo: to },
    include: assignmentInclude,
  });
  return presentAssignment(updated);
}

export async function removeAssignment(assignmentId: number) {
  const existing = await prisma.employeeScheduleAssignment.findUnique({ where: { assignmentId } });
  if (!existing) throw new NotFoundError('Schedule assignment', assignmentId);
  await prisma.employeeScheduleAssignment.delete({ where: { assignmentId } });
}

/** Guard used by routers for HR-only sub-resources on another employee. */
export function assertHrOrSelf(actor: Actor, employeeId: number) {
  if (!canSeeAllEmployees(actor) && actor.employeeId !== employeeId) {
    throw new ForbiddenError('You can only access your own records');
  }
}
