import type { Prisma } from '../../generated/prisma/client';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type {
  CreateSalaryStructureInput,
  ListSalaryStructuresQuery,
  ReorderSalaryRulesInput,
  UpdateSalaryStructureInput,
} from './schema';

const listInclude = {
  _count: { select: { rules: true, payruns: true } },
} as const;

function presentList(row: Prisma.SalaryStructureGetPayload<{ include: typeof listInclude }>) {
  const { _count, ...structure } = row;
  return { ...structure, ruleCount: _count.rules, payrunCount: _count.payruns };
}

async function assertUniqueName(name: string, excludingId?: number) {
  const duplicate = await prisma.salaryStructure.findFirst({
    where: { name, ...(excludingId ? { salaryStructureId: { not: excludingId } } : {}) },
    select: { salaryStructureId: true },
  });
  if (duplicate) throw new ConflictError('A salary structure with this name already exists', { name: 'Name must be unique' });
}

export async function list(query: ListSalaryStructuresQuery) {
  const where: Prisma.SalaryStructureWhereInput = {
    ...(query.q ? { OR: [{ name: { contains: query.q } }, { description: { contains: query.q } }] } : {}),
    ...(query.active !== undefined ? { isActive: query.active } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.salaryStructure.findMany({
      where,
      include: listInclude,
      ...toSkipTake(query),
      orderBy: toOrderBy(query, ['salaryStructureId', 'name', 'currency', 'isActive', 'createdAt'] as const, 'name'),
    }),
    prisma.salaryStructure.count({ where }),
  ]);
  return listResponse(rows.map(presentList), total, query);
}

export async function get(salaryStructureId: number) {
  const structure = await prisma.salaryStructure.findUnique({
    where: { salaryStructureId },
    include: {
      rules: { orderBy: { sequence: 'asc' } },
      _count: { select: { payruns: true } },
    },
  });
  if (!structure) throw new NotFoundError('Salary structure', salaryStructureId);
  const { _count, ...rest } = structure;
  return { ...rest, ruleCount: structure.rules.length, payrunCount: _count.payruns };
}

export async function create(input: CreateSalaryStructureInput) {
  await assertUniqueName(input.name);
  const row = await prisma.salaryStructure.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      currency: input.currency,
      isActive: input.isActive ?? true,
    },
    select: { salaryStructureId: true },
  });
  return get(row.salaryStructureId);
}

export async function update(salaryStructureId: number, input: UpdateSalaryStructureInput) {
  const existing = await prisma.salaryStructure.findUnique({ where: { salaryStructureId }, select: { salaryStructureId: true } });
  if (!existing) throw new NotFoundError('Salary structure', salaryStructureId);
  if (input.name) await assertUniqueName(input.name, salaryStructureId);
  await prisma.salaryStructure.update({
    where: { salaryStructureId },
    data: {
      ...input,
      ...(input.description === undefined ? {} : { description: input.description }),
    },
  });
  return get(salaryStructureId);
}

export async function reorderRules(salaryStructureId: number, input: ReorderSalaryRulesInput) {
  const structure = await prisma.salaryStructure.findUnique({
    where: { salaryStructureId },
    select: { rules: { select: { salaryRuleId: true } } },
  });
  if (!structure) throw new NotFoundError('Salary structure', salaryStructureId);
  const owned = new Set(structure.rules.map((rule) => rule.salaryRuleId));
  const foreign = input.rules.filter((rule) => !owned.has(rule.salaryRuleId));
  if (foreign.length > 0) {
    throw new BusinessRuleError('Every reordered rule must belong to this salary structure', {
      salaryRuleIds: foreign.map((rule) => rule.salaryRuleId),
    });
  }

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < input.rules.length; index += 1) {
      await tx.salaryRule.update({
        where: { salaryRuleId: input.rules[index].salaryRuleId },
        data: { sequence: -(index + 1) },
      });
    }
    for (const rule of input.rules) {
      await tx.salaryRule.update({ where: { salaryRuleId: rule.salaryRuleId }, data: { sequence: rule.sequence } });
    }
  });
  return get(salaryStructureId);
}

export async function remove(salaryStructureId: number) {
  const structure = await prisma.salaryStructure.findUnique({
    where: { salaryStructureId },
    include: { rules: { select: { salaryRuleId: true } }, _count: { select: { payruns: true } } },
  });
  if (!structure) throw new NotFoundError('Salary structure', salaryStructureId);
  const payslipLines = await prisma.payslipLine.count({
    where: { salaryRuleId: { in: structure.rules.map((rule) => rule.salaryRuleId) } },
  });
  if (structure._count.payruns > 0 || payslipLines > 0) {
    throw new BusinessRuleError('This salary structure is referenced by payroll history. Deactivate it instead of deleting it.', {
      canDeactivate: true,
      references: { payruns: structure._count.payruns, payslipLines },
    });
  }
  await prisma.$transaction(async (tx) => {
    await tx.salaryRule.deleteMany({ where: { salaryStructureId } });
    await tx.salaryStructure.delete({ where: { salaryStructureId } });
  });
}
