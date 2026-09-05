import type { Prisma } from '../../generated/prisma/client';
import { BusinessRuleError, NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type { CreateLeaveTypeInput, ListLeaveTypesQuery, UpdateLeaveTypeInput } from './schema';

const include = { _count: { select: { leaveBalances: true, timeOffRequests: true } } } as const;

function present(t: Prisma.LeaveTypeGetPayload<{ include: typeof include }>) {
  const { _count, ...rest } = t;
  return {
    ...rest,
    /** Derived: types with a default of 0 days are not balance-tracked. */
    requiresBalance: t.defaultAnnualDays.greaterThan(0),
    balanceCount: _count.leaveBalances,
    requestCount: _count.timeOffRequests,
  };
}

export async function list(query: ListLeaveTypesQuery) {
  const where: Prisma.LeaveTypeWhereInput = query.q ? { typeName: { contains: query.q } } : {};
  const [rows, total] = await Promise.all([
    prisma.leaveType.findMany({
      where,
      include,
      ...toSkipTake(query),
      orderBy: toOrderBy(query, ['leaveTypeId', 'typeName', 'defaultAnnualDays'] as const, 'typeName'),
    }),
    prisma.leaveType.count({ where }),
  ]);
  return listResponse(rows.map(present), total, query);
}

export async function get(leaveTypeId: number) {
  const t = await prisma.leaveType.findUnique({ where: { leaveTypeId }, include });
  if (!t) throw new NotFoundError('Leave type', leaveTypeId);
  return present(t);
}

export async function create(input: CreateLeaveTypeInput) {
  return present(await prisma.leaveType.create({ data: input, include }));
}

export async function update(leaveTypeId: number, input: UpdateLeaveTypeInput) {
  await get(leaveTypeId);
  return present(await prisma.leaveType.update({ where: { leaveTypeId }, data: input, include }));
}

export async function remove(leaveTypeId: number) {
  const t = await get(leaveTypeId);
  if (t.balanceCount > 0 || t.requestCount > 0) {
    throw new BusinessRuleError('Leave type is referenced by balances or requests and cannot be deleted');
  }
  await prisma.leaveType.delete({ where: { leaveTypeId } });
}
