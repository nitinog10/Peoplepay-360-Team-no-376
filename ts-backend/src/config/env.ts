import 'dotenv/config';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_SECURE: booleanString,

  DEFAULT_CURRENCY: z.string().length(3).toUpperCase().default('USD'),
  APP_TIMEZONE: z.string().min(1).default('UTC'),
  LATE_GRACE_MINUTES: z.coerce.number().int().min(0).default(0),

  SEED_HR_USERNAME: z.string().default('hr.manager'),
  SEED_HR_PASSWORD: z.string().min(8).default('ChangeMe123!'),
  SEED_EMPLOYEE_PASSWORD: z.string().min(8).default('Employee123!'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  // Validate the timezone once at boot so downstream code can trust it.
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: parsed.data.APP_TIMEZONE });
  } catch {
    throw new Error(`Invalid APP_TIMEZONE "${parsed.data.APP_TIMEZONE}"`);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
