import type { Prisma } from '../../generated/prisma/client';
import { NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type { ListSalaryStructuresQuery } from './schema';

const listInclude = {
  _count: { select: { rules: true, payruns: true } },
} as const;

function presentList(row: Prisma.SalaryStructureGetPayload<{ include: typeof listInclude }>) {
  const { _count, ...structure } = row;
  return { ...structure, ruleCount: _count.rules, payrunCount: _count.payruns };
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
      orderBy: toOrderBy(
        query,
        ['salaryStructureId', 'name', 'currency', 'isActive', 'createdAt'] as const,
        'name',
      ),
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
