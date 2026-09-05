import { permissionsFor } from '../../auth/permissions';
import { NotFoundError, UnauthorizedError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyPassword,
  type Actor,
} from '../../lib/security';
import type { LoginInput } from './schema';

const userWithContext = {
  role: true,
  employee: {
    select: {
      employeeId: true,
      firstName: true,
      lastName: true,
      email: true,
      jobTitle: true,
      departmentId: true,
      status: true,
      department: { select: { departmentId: true, departmentName: true } },
    },
  },
} as const;

type UserWithContext = NonNullable<
  Awaited<ReturnType<typeof prisma.user.findFirst<{ include: typeof userWithContext }>>>
>;

function toActor(user: UserWithContext): Actor {
  return {
    userId: user.userId,
    employeeId: user.employeeId,
    role: user.role.roleName,
    username: user.username,
  };
}

export function presentUser(user: UserWithContext) {
  return {
    userId: user.userId,
    username: user.username,
    role: user.role.roleName,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    employee: user.employee,
    permissions: permissionsFor(user.role.roleName),
  };
}

async function issueSession(user: UserWithContext) {
  const actor = toActor(user);
  const access = signAccessToken(actor);
  const refresh = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.userId, tokenHash: refresh.hash, expiresAt: refresh.expiresAt },
  });
  return {
    accessToken: access.token,
    expiresIn: access.expiresIn,
    tokenType: 'Bearer' as const,
    refreshToken: refresh.raw,
    refreshExpiresAt: refresh.expiresAt,
    user: presentUser(user),
  };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: input.username }, { employee: { email: input.username } }],
    },
    include: userWithContext,
  });
  // Same error for unknown user / wrong password / inactive to avoid user enumeration.
  if (!user || !user.isActive) throw new UnauthorizedError('Invalid credentials');
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw new UnauthorizedError('Invalid credentials');

  await prisma.user.update({ where: { userId: user.userId }, data: { lastLoginAt: new Date() } });
  return issueSession(user);
}

export async function refresh(rawToken: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { include: userWithContext } },
  });
  if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
    throw new UnauthorizedError('Refresh token is invalid or expired');
  }
  if (!stored.user.isActive) throw new UnauthorizedError('Account is inactive');

  // Rotation: the presented token is revoked and a new one is issued.
  await prisma.refreshToken.update({ where: { tokenId: stored.tokenId }, data: { revokedAt: new Date() } });
  return issueSession(stored.user);
}

export async function logout(rawToken: string | undefined) {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function me(actor: Actor) {
  const user = await prisma.user.findUnique({ where: { userId: actor.userId }, include: userWithContext });
  if (!user) throw new NotFoundError('User', actor.userId);
  return presentUser(user);
}
