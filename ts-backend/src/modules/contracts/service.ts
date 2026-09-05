import { scopeToEmployee } from '../../auth/permissions';
import { env } from '../../config/env';
import type { Prisma } from '../../generated/prisma/client';
import { todayLocal } from '../../lib/dates';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type { Actor } from '../../lib/security';
import type { CreateContractInput, ListContractsQuery, TerminateContractInput, UpdateContractInput } from './schema';

const include = {
  employee: { select: { employeeId: true, firstName: true, lastName: true, email: true, departmentId: true } },
  creator: { select: { employeeId: true, firstName: true, lastName: true } },
} as const;

type ContractRow = Prisma.ContractGetPayload<{ include: typeof include }>;

function present(c: ContractRow, today: Date) {
  const covers =
    c.status === 'ACTIVE' &&
    c.startDate.getTime() <= today.getTime() &&
    (c.endDate === null || c.endDate.getTime() >= today.getTime());
  return { ...c, isCurrent: covers };
}

const FAR_FUTURE = new Date('9999-12-31T00:00:00.000Z');

/** Persist EXPIRED for ACTIVE contracts whose end date has passed. Idempotent. */
export async function expireContracts(today: Date = todayLocal()) {
  const result = await prisma.contract.updateMany({
    where: { status: 'ACTIVE', endDate: { lt: today } },
    data: { status: 'EXPIRED' },
  });
  return result.count;
}

/** The single resolver payroll will reuse later: the ACTIVE contract covering `date`. */
export async function getActiveContract(employeeId: number, date: Date = todayLocal()) {
  return prisma.contract.findFirst({
    where: {
      employeeId,
      status: 'ACTIVE',
      startDate: { lte: date },
      OR: [{ endDate: null }, { endDate: { gte: date } }],
    },
    orderBy: { startDate: 'desc' },
    include,
  });
}

async function assertNoOverlap(employeeId: number, start: Date, end: Date | null, excludeId?: number) {
  const clash = await prisma.contract.findMany({
    where: {
      employeeId,
      status: 'ACTIVE',
      ...(excludeId ? { contractId: { not: excludeId } } : {}),
      startDate: { lte: end ?? FAR_FUTURE },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    select: { contractId: true, startDate: true, endDate: true },
  });
  if (clash.length > 0) {
    throw new ConflictError('Employee already has an ACTIVE contract overlapping this period', { conflicts: clash });
  }
}

export async function list(actor: Actor, query: ListContractsQuery) {
  await expireContracts();
  const today = todayLocal();
  const own = scopeToEmployee(actor, query.employeeId);
  const where: Prisma.ContractWhereInput = {
    ...(own !== undefined ? { employeeId: own } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.contractType ? { contractType: query.contractType } : {}),
    ...(query.activeOn
      ? { startDate: { lte: query.activeOn }, OR: [{ endDate: null }, { endDate: { gte: query.activeOn } }] }
      : {}),
    ...(query.q
      ? {
          employee: {
            OR: [{ firstName: { contains: query.q } }, { lastName: { contains: query.q } }, { email: { contains: query.q } }],
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include,
      ...toSkipTake(query),
      orderBy: toOrderBy(query, ['contractId', 'startDate', 'endDate', 'baseSalary', 'status', 'createdAt'] as const, 'startDate'),
    }),
    prisma.contract.count({ where }),
  ]);
  return listResponse(rows.map((c) => present(c, today)), total, query);
}

async function findOrThrow(contractId: number): Promise<ContractRow> {
  const c = await prisma.contract.findUnique({ where: { contractId }, include });
  if (!c) throw new NotFoundError('Contract', contractId);
  return c;
}

export async function get(actor: Actor, contractId: number) {
  await expireContracts();
  const c = await findOrThrow(contractId);
  scopeToEmployee(actor, c.employeeId);
  return present(c, todayLocal());
}

export async function create(actor: Actor, input: CreateContractInput) {
  const employee = await prisma.employee.findUnique({ where: { employeeId: input.employeeId } });
  if (!employee) throw new NotFoundError('Employee', input.employeeId);
  if (employee.status === 'TERMINATED') throw new BusinessRuleError('Cannot create a contract for a terminated employee');

  const today = todayLocal();
  let status = input.status;
  if (status === 'ACTIVE' && input.endDate && input.endDate.getTime() < today.getTime()) status = 'EXPIRED';
  if (status === 'ACTIVE') await assertNoOverlap(input.employeeId, input.startDate, input.endDate ?? null);

  const created = await prisma.contract.create({
    data: {
      employeeId: input.employeeId,
      contractType: input.contractType,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      baseSalary: input.baseSalary ?? null,
      currency: input.currency ?? env.DEFAULT_CURRENCY,
      status,
      documentUrl: input.documentUrl ?? null,
      createdBy: actor.employeeId,
    },
    include,
  });
  return present(created, today);
}

export async function update(contractId: number, input: UpdateContractInput) {
  const existing = await findOrThrow(contractId);
  const startDate = input.startDate ?? existing.startDate;
  const endDate = input.endDate === undefined ? existing.endDate : input.endDate;
  if (endDate && endDate.getTime() < startDate.getTime()) throw new BusinessRuleError('endDate must be on or after startDate');

  const today = todayLocal();
  let status = input.status ?? existing.status;
  if (status === 'ACTIVE' && endDate && endDate.getTime() < today.getTime()) status = 'EXPIRED';
  if (status === 'ACTIVE') await assertNoOverlap(existing.employeeId, startDate, endDate, contractId);

  const updated = await prisma.contract.update({
    where: { contractId },
    data: {
      ...(input.contractType !== undefined ? { contractType: input.contractType } : {}),
      ...(input.baseSalary !== undefined ? { baseSalary: input.baseSalary } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.documentUrl !== undefined ? { documentUrl: input.documentUrl } : {}),
      startDate,
      endDate,
      status,
    },
    include,
  });
  return present(updated, today);
}

export async function terminate(contractId: number, input: TerminateContractInput) {
  const existing = await findOrThrow(contractId);
  if (existing.status !== 'ACTIVE') throw new BusinessRuleError(`Only ACTIVE contracts can be terminated (current: ${existing.status})`);
  const endDate = input.endDate ?? todayLocal();
  if (endDate.getTime() < existing.startDate.getTime()) throw new BusinessRuleError('endDate cannot be before startDate');
  const updated = await prisma.contract.update({
    where: { contractId },
    data: { status: 'TERMINATED', endDate },
    include,
  });
  return present(updated, todayLocal());
}

export async function remove(contractId: number) {
  await findOrThrow(contractId);
  await prisma.contract.delete({ where: { contractId } });
}
