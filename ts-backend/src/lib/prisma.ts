import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';
import { logger } from './logger';

/**
 * Prisma 7 requires a driver adapter. We parse DATABASE_URL ourselves so the
 * same mysql:// connection string works for both the Prisma CLI (migrations)
 * and the runtime pool.
 */
function poolConfigFromUrl(databaseUrl: string) {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid URL, e.g. mysql://user:pass@host:3306/db');
  }
  if (!['mysql:', 'mariadb:'].includes(url.protocol)) {
    throw new Error(`Unsupported DATABASE_URL protocol "${url.protocol}" (expected mysql://)`);
  }
  const database = url.pathname.replace(/^\//, '');
  if (!database) throw new Error('DATABASE_URL must include a database name');
  const limit = Number(url.searchParams.get('connection_limit') ?? 10);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: Number.isFinite(limit) && limit > 0 ? limit : 10,
    // Keep the driver from applying local-timezone shifts to DATETIME values.
    timezone: 'Z',
  };
}

const adapter = new PrismaMariaDb(poolConfigFromUrl(env.DATABASE_URL));

export const prisma = new PrismaClient({ adapter });

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connection established');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
