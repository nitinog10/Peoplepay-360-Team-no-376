import type { Prisma } from '../../generated/prisma/client';
import { BusinessRuleError, NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type { CreateDepartmentInput, ListDepartmentsQuery, UpdateDepartmentInput } from './schema';

const include = { _count: { select: { employees: true } } } as const;

function present(d: Prisma.DepartmentGetPayload<{ include: typeof include }>) {
  const { _count, ...rest } = d;
  return { ...rest, employeeCount: _count.employees };
}

export async function list(query: ListDepartmentsQuery) {
  const where: Prisma.DepartmentWhereInput = query.q ? { departmentName: { contains: query.q } } : {};
  const [rows, total] = await Promise.all([
    prisma.department.findMany({
      where,
      include,
      ...toSkipTake(query),
      orderBy: toOrderBy(query, ['departmentId', 'departmentName'] as const, 'departmentName'),
    }),
    prisma.department.count({ where }),
  ]);
  return listResponse(rows.map(present), total, query);
}

export async function get(departmentId: number) {
  const d = await prisma.department.findUnique({ where: { departmentId }, include });
  if (!d) throw new NotFoundError('Department', departmentId);
  return present(d);
}

export async function create(input: CreateDepartmentInput) {
  const d = await prisma.department.create({ data: input, include });
  return present(d);
}

export async function update(departmentId: number, input: UpdateDepartmentInput) {
  await get(departmentId);
  const d = await prisma.department.update({ where: { departmentId }, data: input, include });
  return present(d);
}

export async function remove(departmentId: number) {
  const d = await get(departmentId);
  if (d.employeeCount > 0) {
    throw new BusinessRuleError(`Department has ${d.employeeCount} employee(s); reassign them before deleting`);
  }
  await prisma.department.delete({ where: { departmentId } });
}
