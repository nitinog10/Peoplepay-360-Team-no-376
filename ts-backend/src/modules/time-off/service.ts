import { canSeeAllEmployees, requireEmployeeScope, scopeToEmployee } from '../../auth/permissions';
import type { LeaveType, Prisma } from '../../generated/prisma/client';
import { yearOf } from '../../lib/dates';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type { Actor } from '../../lib/security';
import { getOrCreateBalance, pendingDays } from '../leave-balances/service';
import { countWorkingDays, resolveScheduleFor } from '../work-schedules/resolve';
import type { CreateRequestInput, DecisionInput, ListRequestsQuery, UpdateRequestInput } from './schema';

type Tx = Prisma.TransactionClient | typeof prisma;

const include = {
  employee: {
    select: {
      employeeId: true,
      firstName: true,
      lastName: true,
      email: true,
      department: { select: { departmentId: true, departmentName: true } },
    },
  },
  leaveType: { select: { leaveTypeId: true, typeName: true, defaultAnnualDays: true } },
  approval: { include: { reviewer: { select: { employeeId: true, firstName: true, lastName: true } } } },
} as const;

type RequestRow = Prisma.TimeOffRequestGetPayload<{ include: typeof include }>;

function present(r: RequestRow) {
  return r;
}

async function findOrThrow(id: number, tx: Tx = prisma): Promise<RequestRow> {
  const r = await tx.timeOffRequest.findUnique({ where: { timeOffRequestId: id }, include });
  if (!r) throw new NotFoundError('Time off request', id);
  return r;
}

async function leaveTypeOrThrow(leaveTypeId: number, tx: Tx = prisma): Promise<LeaveType> {
  const t = await tx.leaveType.findUnique({ where: { leaveTypeId } });
  if (!t) throw new NotFoundError('Leave type', leaveTypeId);
  return t;
}

/** Working days in the range according to the employee's schedule on the start date. */
async function computeTotalDays(employeeId: number, start: Date, end: Date, tx: Tx = prisma): Promise<number> {
  const schedule = await resolveScheduleFor(employeeId, start, tx);
  return countWorkingDays(schedule, start, end);
}

async function assertNoOverlap(employeeId: number, start: Date, end: Date, excludeId?: number, tx: Tx = prisma) {
  const clash = await tx.timeOffRequest.findMany({
    where: {
      employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
      ...(excludeId ? { timeOffRequestId: { not: excludeId } } : {}),
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { timeOffRequestId: true, startDate: true, endDate: true, status: true },
  });
  if (clash.length > 0) throw new ConflictError('The employee already has a pending or approved request overlapping these dates', { conflicts: clash });
}

/**
 * Ensure the employee can consume `totalDays` of `leaveType` in `year`.
 * Untracked types (default 0 days, no balance row) always pass.
 */
async function assertBalance(tx: Tx, employeeId: number, leaveType: LeaveType, year: number, totalDays: number, excludeRequestId?: number) {
  const balance = await getOrCreateBalance(tx, employeeId, leaveType, year);
  if (!balance) return null;
  const pending = (await pendingDays([employeeId], year, tx, excludeRequestId)).get(`${employeeId}:${leaveType.leaveTypeId}`) ?? 0;
  const remaining = balance.allocatedDays.toNumber() + balance.carriedForwardDays.toNumber() - balance.usedDays.toNumber();
  const available = Math.round((remaining - pending) * 100) / 100;
  if (available < totalDays) {
    throw new BusinessRuleError(`Insufficient ${leaveType.typeName} balance: ${available} day(s) available, ${totalDays} requested`, {
      leaveType: leaveType.typeName,
      year,
      allocatedDays: balance.allocatedDays.toNumber(),
      carriedForwardDays: balance.carriedForwardDays.toNumber(),
      usedDays: balance.usedDays.toNumber(),
      pendingDays: pending,
      availableDays: available,
      requestedDays: totalDays,
    });
  }
  return balance;
}

function assertSameYear(start: Date, end: Date) {
  if (yearOf(start) !== yearOf(end)) {
    throw new BusinessRuleError('A request cannot span two calendar years; please submit one request per year');
  }
}

// ---------- queries ----------

export async function list(actor: Actor, query: ListRequestsQuery) {
  const own = scopeToEmployee(actor, query.employeeId);
  const where: Prisma.TimeOffRequestWhereInput = {
    ...(own !== undefined ? { employeeId: own } : {}),
    ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from ? { endDate: { gte: query.from } } : {}),
    ...(query.to ? { startDate: { lte: query.to } } : {}),
    ...(query.q
      ? {
          OR: [
            { employee: { firstName: { contains: query.q } } },
            { employee: { lastName: { contains: query.q } } },
            { employee: { email: { contains: query.q } } },
            { reason: { contains: query.q } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.timeOffRequest.findMany({
      where,
      include,
      ...toSkipTake(query),
      orderBy: toOrderBy(query, ['requestedAt', 'startDate', 'endDate', 'status', 'totalDays', 'timeOffRequestId'] as const, 'requestedAt'),
    }),
    prisma.timeOffRequest.count({ where }),
  ]);
  return listResponse(rows.map(present), total, query);
}

export async function get(actor: Actor, id: number) {
  const r = await findOrThrow(id);
  scopeToEmployee(actor, r.employeeId);
  return present(r);
}

export async function getApproval(actor: Actor, id: number) {
  const r = await findOrThrow(id);
  scopeToEmployee(actor, r.employeeId);
  if (!r.approval) throw new NotFoundError('Approval for request', id);
  return r.approval;
}

// ---------- lifecycle ----------

export async function create(actor: Actor, input: CreateRequestInput) {
  const employeeId = requireEmployeeScope(actor, input.employeeId);
  assertSameYear(input.startDate, input.endDate);

  const employee = await prisma.employee.findUnique({ where: { employeeId } });
  if (!employee) throw new NotFoundError('Employee', employeeId);
  if (employee.status !== 'ACTIVE') throw new BusinessRuleError('Only active employees can request time off');

  const created = await prisma.$transaction(async (tx) => {
    const leaveType = await leaveTypeOrThrow(input.leaveTypeId, tx);
    await assertNoOverlap(employeeId, input.startDate, input.endDate, undefined, tx);
    const totalDays = await computeTotalDays(employeeId, input.startDate, input.endDate, tx);
    if (totalDays <= 0) throw new BusinessRuleError('The selected dates contain no working days for this employee');
    await assertBalance(tx, employeeId, leaveType, yearOf(input.startDate), totalDays);
    return tx.timeOffRequest.create({
      data: {
        employeeId,
        leaveTypeId: input.leaveTypeId,
        startDate: input.startDate,
        endDate: input.endDate,
        totalDays,
        reason: input.reason ?? null,
      },
      include,
    });
  });
  return present(created);
}

export async function update(actor: Actor, id: number, input: UpdateRequestInput) {
  const existing = await findOrThrow(id);
  scopeToEmployee(actor, existing.employeeId);
  if (existing.status !== 'PENDING') throw new BusinessRuleError(`Only PENDING requests can be edited (current: ${existing.status})`);

  const startDate = input.startDate ?? existing.startDate;
  const endDate = input.endDate ?? existing.endDate;
  if (endDate.getTime() < startDate.getTime()) throw new BusinessRuleError('endDate must be on or after startDate');
  assertSameYear(startDate, endDate);
  const leaveTypeId = input.leaveTypeId ?? existing.leaveTypeId;

  const updated = await prisma.$transaction(async (tx) => {
    const leaveType = await leaveTypeOrThrow(leaveTypeId, tx);
    await assertNoOverlap(existing.employeeId, startDate, endDate, id, tx);
    const totalDays = await computeTotalDays(existing.employeeId, startDate, endDate, tx);
    if (totalDays <= 0) throw new BusinessRuleError('The selected dates contain no working days for this employee');
    await assertBalance(tx, existing.employeeId, leaveType, yearOf(startDate), totalDays, id);
    return tx.timeOffRequest.update({
      where: { timeOffRequestId: id },
      data: { leaveTypeId, startDate, endDate, totalDays, ...(input.reason !== undefined ? { reason: input.reason } : {}) },
      include,
    });
  });
  return present(updated);
}

export async function approve(actor: Actor, id: number, input: DecisionInput) {
  const updated = await prisma.$transaction(async (tx) => {
    const r = await findOrThrow(id, tx);
    if (r.status !== 'PENDING') throw new BusinessRuleError(`Only PENDING requests can be approved (current: ${r.status})`);
    const leaveType = await leaveTypeOrThrow(r.leaveTypeId, tx);
    const year = yearOf(r.startDate);
    const totalDays = r.totalDays.toNumber();
    const balance = await assertBalance(tx, r.employeeId, leaveType, year, totalDays, id);

    await tx.timeOffApproval.create({
      data: { timeOffRequestId: id, reviewedBy: actor.employeeId, decision: 'APPROVED', comments: input.comments ?? null },
    });
    if (balance) {
      await tx.leaveBalance.update({ where: { leaveBalanceId: balance.leaveBalanceId }, data: { usedDays: { increment: totalDays } } });
    }
    return tx.timeOffRequest.update({ where: { timeOffRequestId: id }, data: { status: 'APPROVED' }, include });
  });
  return present(updated);
}

export async function reject(actor: Actor, id: number, input: DecisionInput) {
  const updated = await prisma.$transaction(async (tx) => {
    const r = await findOrThrow(id, tx);
    if (r.status !== 'PENDING') throw new BusinessRuleError(`Only PENDING requests can be rejected (current: ${r.status})`);
    await tx.timeOffApproval.create({
      data: { timeOffRequestId: id, reviewedBy: actor.employeeId, decision: 'REJECTED', comments: input.comments ?? null },
    });
    return tx.timeOffRequest.update({ where: { timeOffRequestId: id }, data: { status: 'REJECTED' }, include });
  });
  return present(updated);
}

/** Owner or HR may cancel PENDING; only HR may cancel APPROVED (which restores the balance). */
export async function cancel(actor: Actor, id: number) {
  const updated = await prisma.$transaction(async (tx) => {
    const r = await findOrThrow(id, tx);
    const isHr = canSeeAllEmployees(actor);
    if (!isHr && r.employeeId !== actor.employeeId) throw new ForbiddenError('You can only cancel your own requests');
    if (r.status === 'PENDING') {
      // ok for owner and HR
    } else if (r.status === 'APPROVED') {
      if (!isHr) throw new ForbiddenError('Approved requests can only be cancelled by HR');
      const leaveType = await leaveTypeOrThrow(r.leaveTypeId, tx);
      const balance = await tx.leaveBalance.findUnique({
        where: { employeeId_leaveTypeId_year: { employeeId: r.employeeId, leaveTypeId: leaveType.leaveTypeId, year: yearOf(r.startDate) } },
      });
      if (balance) {
        const restored = Math.max(0, balance.usedDays.toNumber() - r.totalDays.toNumber());
        await tx.leaveBalance.update({ where: { leaveBalanceId: balance.leaveBalanceId }, data: { usedDays: restored } });
      }
    } else {
      throw new BusinessRuleError(`Request is already ${r.status}`);
    }
    return tx.timeOffRequest.update({ where: { timeOffRequestId: id }, data: { status: 'CANCELLED' }, include });
  });
  return present(updated);
}
