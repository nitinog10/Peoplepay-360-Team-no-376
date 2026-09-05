import type { Prisma } from '../../generated/prisma/client';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type { ListSalaryRulesQuery } from './schema';

const include = {
  salaryStructure: {
    select: { salaryStructureId: true, name: true, currency: true, isActive: true },
  },
} as const;

export async function list(query: ListSalaryRulesQuery) {
  const where: Prisma.SalaryRuleWhereInput = {
    ...(query.structureId ? { salaryStructureId: query.structureId } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.active !== undefined ? { isActive: query.active } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q } },
            { code: { contains: query.q } },
            { salaryStructure: { name: { contains: query.q } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.salaryRule.findMany({
      where,
      include,
      ...toSkipTake(query),
      orderBy: toOrderBy(
        query,
        ['salaryRuleId', 'name', 'code', 'category', 'sequence', 'isActive', 'createdAt'] as const,
        'sequence',
      ),
    }),
    prisma.salaryRule.count({ where }),
  ]);
  return listResponse(rows, total, query);
}
