import { scopeToEmployee } from '../../auth/permissions';
import type { LeaveType, Prisma } from '../../generated/prisma/client';
import { todayLocal } from '../../lib/dates';
import { NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type { Actor } from '../../lib/security';
import type { CreateBalanceInput, InitializeYearInput, ListBalancesQuery, RecomputeInput, UpdateBalanceInput } from './schema';

type Tx = Prisma.TransactionClient | typeof prisma;

const include = {
  leaveType: { select: { leaveTypeId: true, typeName: true, defaultAnnualDays: true } },
  employee: { select: { employeeId: true, firstName: true, lastName: true, email: true } },
} as const;

type BalanceRow = Prisma.LeaveBalanceGetPayload<{ include: typeof include }>;

function yearRange(year: number) {
  return { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) };
}

/** PENDING request days per (employeeId, leaveTypeId) for a year. */
export async function pendingDays(employeeIds: number[], year: number, tx: Tx = prisma, excludeRequestId?: number) {
  if (employeeIds.length === 0) return new Map<string, number>();
  const groups = await tx.timeOffRequest.groupBy({
    by: ['employeeId', 'leaveTypeId'],
    where: {
      status: 'PENDING',
      employeeId: { in: employeeIds },
      startDate: yearRange(year),
      ...(excludeRequestId ? { timeOffRequestId: { not: excludeRequestId } } : {}),
    },
    _sum: { totalDays: true },
  });
  return new Map(groups.map((g) => [`${g.employeeId}:${g.leaveTypeId}`, g._sum.totalDays?.toNumber() ?? 0]));
}

export function presentBalance(b: BalanceRow, pending = 0) {
  const allocated = b.allocatedDays.toNumber();
  const carried = b.carriedForwardDays.toNumber();
  const used = b.usedDays.toNumber();
  const remaining = round2(allocated + carried - used);
  return {
    ...b,
    /** allocated + carriedForward − used (derived, never stored) */
    remainingDays: remaining,
    pendingDays: pending,
    /** remaining − pending: what a new request can still consume */
    availableDays: round2(remaining - pending),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function presentMany(rows: BalanceRow[]) {
  const byYear = new Map<number, number[]>();
  for (const r of rows) byYear.set(r.year, [...(byYear.get(r.year) ?? []), r.employeeId]);
  const pendingMaps = await Promise.all([...byYear.entries()].map(async ([y, ids]) => [y, await pendingDays([...new Set(ids)], y)] as const));
  const pendingByYear = new Map(pendingMaps);
  return rows.map((r) => presentBalance(r, pendingByYear.get(r.year)?.get(`${r.employeeId}:${r.leaveTypeId}`) ?? 0));
}

export async function list(actor: Actor, query: ListBalancesQuery) {
  const own = scopeToEmployee(actor, query.employeeId);
  const where: Prisma.LeaveBalanceWhereInput = {
    ...(own !== undefined ? { employeeId: own } : {}),
    ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
    ...(query.year ? { year: query.year } : {}),
    ...(query.q
      ? {
          employee: {
            OR: [{ firstName: { contains: query.q } }, { lastName: { contains: query.q } }, { email: { contains: query.q } }],
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.leaveBalance.findMany({
      where,
      include,
      ...toSkipTake(query),
      orderBy: toOrderBy(query, ['year', 'employeeId', 'leaveTypeId', 'allocatedDays', 'usedDays', 'updatedAt'] as const, 'year'),
    }),
    prisma.leaveBalance.count({ where }),
  ]);
  return listResponse(await presentMany(rows), total, query);
}

export async function mine(actor: Actor, year: number = todayLocal().getUTCFullYear()) {
  const rows = await prisma.leaveBalance.findMany({
    where: { employeeId: actor.employeeId, year },
    include,
    orderBy: { leaveTypeId: 'asc' },
  });
  return { year, data: await presentMany(rows) };
}

export async function get(actor: Actor, leaveBalanceId: number) {
  const b = await prisma.leaveBalance.findUnique({ where: { leaveBalanceId }, include });
  if (!b) throw new NotFoundError('Leave balance', leaveBalanceId);
  scopeToEmployee(actor, b.employeeId);
  return (await presentMany([b]))[0];
}

export async function create(input: CreateBalanceInput) {
  const [employee, leaveType] = await Promise.all([
    prisma.employee.findUnique({ where: { employeeId: input.employeeId } }),
    prisma.leaveType.findUnique({ where: { leaveTypeId: input.leaveTypeId } }),
  ]);
  if (!employee) throw new NotFoundError('Employee', input.employeeId);
  if (!leaveType) throw new NotFoundError('Leave type', input.leaveTypeId);
  const b = await prisma.leaveBalance.create({ data: input, include });
  return (await presentMany([b]))[0];
}

export async function update(leaveBalanceId: number, input: UpdateBalanceInput) {
  const existing = await prisma.leaveBalance.findUnique({ where: { leaveBalanceId } });
  if (!existing) throw new NotFoundError('Leave balance', leaveBalanceId);
  const b = await prisma.leaveBalance.update({ where: { leaveBalanceId }, data: input, include });
  return (await presentMany([b]))[0];
}

export async function remove(leaveBalanceId: number) {
  const existing = await prisma.leaveBalance.findUnique({ where: { leaveBalanceId } });
  if (!existing) throw new NotFoundError('Leave balance', leaveBalanceId);
  await prisma.leaveBalance.delete({ where: { leaveBalanceId } });
}

/**
 * Used by time-off: the balance row for (employee, type, year). Creates it from the
 * type's default when missing. Returns null for untracked types (default 0 days).
 */
export async function getOrCreateBalance(tx: Tx, employeeId: number, leaveType: LeaveType, year: number) {
  const existing = await tx.leaveBalance.findUnique({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: leaveType.leaveTypeId, year } },
  });
  if (existing) return existing;
  if (!leaveType.defaultAnnualDays.greaterThan(0)) return null;
  return tx.leaveBalance.create({
    data: { employeeId, leaveTypeId: leaveType.leaveTypeId, year, allocatedDays: leaveType.defaultAnnualDays },
  });
}

/** Create the year's balances for active employees from each leave type's default. */
export async function initializeYear(input: InitializeYearInput) {
  const [employees, types, existing] = await Promise.all([
    prisma.employee.findMany({
      where: { status: 'ACTIVE', ...(input.employeeIds ? { employeeId: { in: input.employeeIds } } : {}) },
      select: { employeeId: true },
    }),
    prisma.leaveType.findMany({ where: { defaultAnnualDays: { gt: 0 } } }),
    prisma.leaveBalance.findMany({ where: { year: input.year }, select: { employeeId: true, leaveTypeId: true } }),
  ]);
  const have = new Set(existing.map((e) => `${e.employeeId}:${e.leaveTypeId}`));

  const previous = input.carryForward
    ? await prisma.leaveBalance.findMany({ where: { year: input.year - 1, employeeId: { in: employees.map((e) => e.employeeId) } } })
    : [];
  const prevRemaining = new Map(
    previous.map((p) => [
      `${p.employeeId}:${p.leaveTypeId}`,
      Math.max(0, p.allocatedDays.toNumber() + p.carriedForwardDays.toNumber() - p.usedDays.toNumber()),
    ]),
  );

  const rows: Prisma.LeaveBalanceCreateManyInput[] = [];
  let skipped = 0;
  for (const e of employees) {
    for (const t of types) {
      const key = `${e.employeeId}:${t.leaveTypeId}`;
      if (have.has(key)) {
        skipped++;
        continue;
      }
      rows.push({
        employeeId: e.employeeId,
        leaveTypeId: t.leaveTypeId,
        year: input.year,
        allocatedDays: t.defaultAnnualDays,
        carriedForwardDays: round2(prevRemaining.get(key) ?? 0),
      });
    }
  }
  if (rows.length > 0) await prisma.leaveBalance.createMany({ data: rows });
  return { year: input.year, employees: employees.length, leaveTypes: types.length, created: rows.length, skipped };
}

/** Safety net: recompute used_days from APPROVED requests and fix any drift. */
export async function recompute(input: RecomputeInput) {
  const where: Prisma.LeaveBalanceWhereInput = input.year ? { year: input.year } : {};
  const balances = await prisma.leaveBalance.findMany({ where });
  const years = [...new Set(balances.map((b) => b.year))];
  const sums = new Map<string, number>();
  for (const y of years) {
    const groups = await prisma.timeOffRequest.groupBy({
      by: ['employeeId', 'leaveTypeId'],
      where: { status: 'APPROVED', startDate: yearRange(y) },
      _sum: { totalDays: true },
    });
    for (const g of groups) sums.set(`${y}:${g.employeeId}:${g.leaveTypeId}`, g._sum.totalDays?.toNumber() ?? 0);
  }
  const corrections: { leaveBalanceId: number; from: number; to: number }[] = [];
  for (const b of balances) {
    const expected = round2(sums.get(`${b.year}:${b.employeeId}:${b.leaveTypeId}`) ?? 0);
    const current = b.usedDays.toNumber();
    if (expected !== current) corrections.push({ leaveBalanceId: b.leaveBalanceId, from: current, to: expected });
  }
  if (corrections.length > 0) {
    await prisma.$transaction(
      corrections.map((c) => prisma.leaveBalance.update({ where: { leaveBalanceId: c.leaveBalanceId }, data: { usedDays: c.to } })),
    );
  }
  return { checked: balances.length, corrected: corrections.length, corrections };
}
