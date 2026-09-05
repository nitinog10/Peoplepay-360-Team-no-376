import type { Prisma } from '../../generated/prisma/client';
import { ASSIGNABLE_ROLE_NAMES, type AssignableRoleName } from '../../auth/permissions';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { hashPassword, type Actor } from '../../lib/security';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './schema';

const include = {
  role: true,
  employee: {
    select: { employeeId: true, firstName: true, lastName: true, email: true, jobTitle: true, status: true },
  },
} as const;

function present(user: Prisma.UserGetPayload<{ include: typeof include }>) {
  const { passwordHash: _omit, roleId: _r, ...rest } = user;
  return { ...rest, role: user.role.roleName };
}

async function roleIdFor(role: AssignableRoleName): Promise<number> {
  const row = await prisma.role.findUnique({ where: { roleName: role } });
  if (!row) throw new NotFoundError('Role', role);
  return row.roleId;
}

export async function listRoles() {
  return prisma.role.findMany({
    where: { roleName: { in: [...ASSIGNABLE_ROLE_NAMES] } },
    orderBy: { roleId: 'asc' },
  });
}

export async function list(query: ListUsersQuery) {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: { roleName: query.role } } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.q
      ? {
          OR: [
            { username: { contains: query.q } },
            { employee: { firstName: { contains: query.q } } },
            { employee: { lastName: { contains: query.q } } },
            { employee: { email: { contains: query.q } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include,
      ...toSkipTake(query),
      orderBy: toOrderBy(query, ['userId', 'username', 'createdAt', 'lastLoginAt'] as const, 'userId'),
    }),
    prisma.user.count({ where }),
  ]);
  return listResponse(rows.map(present), total, query);
}

export async function get(userId: number) {
  const user = await prisma.user.findUnique({ where: { userId }, include });
  if (!user) throw new NotFoundError('User', userId);
  return present(user);
}

export async function create(input: CreateUserInput) {
  const employee = await prisma.employee.findUnique({
    where: { employeeId: input.employeeId },
    include: { user: { select: { userId: true } } },
  });
  if (!employee) throw new NotFoundError('Employee', input.employeeId);
  if (employee.user) throw new ConflictError('This employee already has a user account');
  if (employee.status === 'TERMINATED') throw new BusinessRuleError('Cannot create a login for a terminated employee');

  const user = await prisma.user.create({
    data: {
      employeeId: input.employeeId,
      username: input.username,
      passwordHash: await hashPassword(input.password),
      roleId: await roleIdFor(input.role),
    },
    include,
  });
  return present(user);
}

export async function update(actor: Actor, userId: number, input: UpdateUserInput) {
  const existing = await prisma.user.findUnique({ where: { userId } });
  if (!existing) throw new NotFoundError('User', userId);

  if (userId === actor.userId) {
    if (input.role !== undefined) throw new BusinessRuleError('You cannot change your own role');
    if (input.isActive === false) throw new BusinessRuleError('You cannot deactivate your own account');
  }

  const data: Prisma.UserUpdateInput = {};
  if (input.username !== undefined) data.username = input.username;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.password !== undefined) data.passwordHash = await hashPassword(input.password);
  if (input.role !== undefined) data.role = { connect: { roleId: await roleIdFor(input.role) } };

  const user = await prisma.user.update({ where: { userId }, data, include });

  // Deactivation or password change invalidates existing sessions.
  if (input.isActive === false || input.password !== undefined) {
    await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  return present(user);
}
