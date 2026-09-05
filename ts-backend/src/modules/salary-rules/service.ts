import type { Prisma } from '../../generated/prisma/client';
import type { SalaryRuleBase, SalaryRuleCategory, SalaryRuleMethod } from '../../generated/prisma/enums';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type { CreateSalaryRuleInput, ListSalaryRulesQuery, UpdateSalaryRuleInput } from './schema';

const include = {
  salaryStructure: {
    select: { salaryStructureId: true, name: true, currency: true, isActive: true },
  },
} as const;

type RuleOperands = {
  method: SalaryRuleMethod;
  fixedAmount?: number | null;
  percentage?: number | null;
  percentageBase?: SalaryRuleBase | null;
  formula?: string | null;
};

function normalizedOperands(value: RuleOperands) {
  return {
    fixedAmount: value.method === 'FIXED' ? value.fixedAmount : null,
    percentage: value.method === 'PERCENTAGE' ? value.percentage : null,
    percentageBase: value.method === 'PERCENTAGE' ? value.percentageBase : null,
    formula: value.method === 'FORMULA' ? value.formula : null,
  };
}

function assertMethodOperands(value: RuleOperands) {
  if (value.method === 'FIXED' && (value.fixedAmount === undefined || value.fixedAmount === null)) {
    throw new BusinessRuleError('Fixed rules require fixedAmount', { fixedAmount: 'Fixed amount is required' });
  }
  if (value.method === 'PERCENTAGE') {
    if (value.percentage === undefined || value.percentage === null) {
      throw new BusinessRuleError('Percentage rules require percentage', { percentage: 'Percentage is required' });
    }
    if (!value.percentageBase) throw new BusinessRuleError('Percentage rules require percentageBase', { percentageBase: 'Percentage base is required' });
  }
  if (value.method === 'FORMULA' && !value.formula) {
    throw new BusinessRuleError('Formula rules require formula', { formula: 'Formula is required' });
  }
}

async function requireStructure(salaryStructureId: number) {
  const structure = await prisma.salaryStructure.findUnique({ where: { salaryStructureId }, select: { salaryStructureId: true } });
  if (!structure) throw new NotFoundError('Salary structure', salaryStructureId);
}

async function assertUnique(code: string, salaryStructureId: number, sequence: number, excludingId?: number) {
  const [codeDuplicate, sequenceDuplicate] = await Promise.all([
    prisma.salaryRule.findFirst({ where: { code, ...(excludingId ? { salaryRuleId: { not: excludingId } } : {}) }, select: { salaryRuleId: true } }),
    prisma.salaryRule.findFirst({
      where: { salaryStructureId, sequence, ...(excludingId ? { salaryRuleId: { not: excludingId } } : {}) },
      select: { salaryRuleId: true },
    }),
  ]);
  if (codeDuplicate) throw new ConflictError('A salary rule with this code already exists', { code: 'Code must be unique' });
  if (sequenceDuplicate) throw new ConflictError('A salary rule already uses this sequence in the structure', { sequence: 'Sequence must be unique within the structure' });
}

export async function list(query: ListSalaryRulesQuery) {
  const where: Prisma.SalaryRuleWhereInput = {
    ...(query.structureId ? { salaryStructureId: query.structureId } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.active !== undefined ? { isActive: query.active } : {}),
    ...(query.q
      ? { OR: [{ name: { contains: query.q } }, { code: { contains: query.q } }, { salaryStructure: { name: { contains: query.q } } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.salaryRule.findMany({
      where,
      include,
      ...toSkipTake(query),
      orderBy: toOrderBy(query, ['salaryRuleId', 'name', 'code', 'category', 'sequence', 'isActive', 'createdAt'] as const, 'sequence'),
    }),
    prisma.salaryRule.count({ where }),
  ]);
  return listResponse(rows, total, query);
}

export async function get(salaryRuleId: number) {
  const rule = await prisma.salaryRule.findUnique({ where: { salaryRuleId }, include });
  if (!rule) throw new NotFoundError('Salary rule', salaryRuleId);
  return rule;
}

export async function create(input: CreateSalaryRuleInput) {
  await requireStructure(input.salaryStructureId);
  assertMethodOperands(input);
  await assertUnique(input.code, input.salaryStructureId, input.sequence);
  const row = await prisma.salaryRule.create({
    data: {
      salaryStructureId: input.salaryStructureId,
      name: input.name,
      code: input.code,
      category: input.category,
      sequence: input.sequence,
      method: input.method,
      ...normalizedOperands(input),
      isActive: input.isActive ?? true,
    },
    select: { salaryRuleId: true },
  });
  return get(row.salaryRuleId);
}

export async function update(salaryRuleId: number, input: UpdateSalaryRuleInput) {
  const existing = await prisma.salaryRule.findUnique({ where: { salaryRuleId } });
  if (!existing) throw new NotFoundError('Salary rule', salaryRuleId);
  const merged = {
    salaryStructureId: input.salaryStructureId ?? existing.salaryStructureId,
    name: input.name ?? existing.name,
    code: input.code ?? existing.code,
    category: (input.category ?? existing.category) as SalaryRuleCategory,
    sequence: input.sequence ?? existing.sequence,
    method: (input.method ?? existing.method) as SalaryRuleMethod,
    fixedAmount: input.fixedAmount === undefined ? existing.fixedAmount?.toNumber() ?? null : input.fixedAmount,
    percentage: input.percentage === undefined ? existing.percentage?.toNumber() ?? null : input.percentage,
    percentageBase: input.percentageBase === undefined ? existing.percentageBase : input.percentageBase,
    formula: input.formula === undefined ? existing.formula : input.formula,
    isActive: input.isActive ?? existing.isActive,
  };
  await requireStructure(merged.salaryStructureId);
  assertMethodOperands(merged);
  await assertUnique(merged.code, merged.salaryStructureId, merged.sequence, salaryRuleId);
  await prisma.salaryRule.update({
    where: { salaryRuleId },
    data: {
      salaryStructureId: merged.salaryStructureId,
      name: merged.name,
      code: merged.code,
      category: merged.category,
      sequence: merged.sequence,
      method: merged.method,
      ...normalizedOperands(merged),
      isActive: merged.isActive,
    },
  });
  return get(salaryRuleId);
}

export async function remove(salaryRuleId: number) {
  const rule = await prisma.salaryRule.findUnique({
    where: { salaryRuleId },
    include: { _count: { select: { payslipLines: true } }, salaryStructure: { select: { _count: { select: { payruns: true } } } } },
  });
  if (!rule) throw new NotFoundError('Salary rule', salaryRuleId);
  const references = { payslipLines: rule._count.payslipLines, payruns: rule.salaryStructure._count.payruns };
  if (references.payslipLines > 0 || references.payruns > 0) {
    throw new BusinessRuleError('This salary rule is referenced by payroll history. Deactivate it instead of deleting it.', {
      canDeactivate: true,
      references,
    });
  }
  await prisma.salaryRule.delete({ where: { salaryRuleId } });
}
