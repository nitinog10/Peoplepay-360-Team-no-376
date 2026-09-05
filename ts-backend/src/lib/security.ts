import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { RoleName } from '../generated/prisma/enums';
import { UnauthorizedError } from './errors';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Identity carried on every authenticated request. */
export interface Actor {
  userId: number;
  employeeId: number;
  role: RoleName;
  username: string;
}

interface AccessTokenPayload {
  sub: string;
  eid: number;
  role: RoleName;
  usr: string;
}

export function signAccessToken(actor: Actor): { token: string; expiresIn: number } {
  const expiresIn = env.JWT_ACCESS_TTL_MINUTES * 60;
  const payload: AccessTokenPayload = {
    sub: String(actor.userId),
    eid: actor.employeeId,
    role: actor.role,
    usr: actor.username,
  };
  const token = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn, algorithm: 'HS256' });
  return { token, expiresIn };
}

export function verifyAccessToken(token: string): Actor {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as AccessTokenPayload;
    return {
      userId: Number(decoded.sub),
      employeeId: decoded.eid,
      role: decoded.role,
      username: decoded.usr,
    };
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

/** Opaque refresh token: random value handed to the client, SHA-256 hash stored in DB. */
export function generateRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomBytes(48).toString('base64url');
  return {
    raw,
    hash: hashToken(raw),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
