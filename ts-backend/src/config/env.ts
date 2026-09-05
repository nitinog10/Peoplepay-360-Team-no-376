import 'dotenv/config';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());
const optionalPort = z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65_535).optional());
const optionalBooleanString = z.preprocess(
  emptyToUndefined,
  z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
);
const seedUsername = z
  .string()
  .trim()
  .min(3)
  .max(50)
  .regex(/^[a-zA-Z0-9._@-]+$/, 'Seed usernames may contain only letters, numbers, dots, underscores, @, and hyphens');
const seedPassword = z.string().min(8).max(200);

const envSchema = z
  .object({
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

    SMTP_HOST: optionalString,
    SMTP_PORT: optionalPort,
    SMTP_SECURE: optionalBooleanString,
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    MAIL_FROM: optionalString,

    SEED_EMPLOYEE_USERNAME: seedUsername.default('employee'),
    SEED_EMPLOYEE_PASSWORD: seedPassword.default('Employee123!'),
    SEED_HR_MANAGER_USERNAME: seedUsername.default('hr.manager'),
    SEED_HR_MANAGER_PASSWORD: seedPassword.default('HrManager123!'),
    SEED_HR_PAYROLL_USER_USERNAME: seedUsername.default('hr.payroll.user'),
    SEED_HR_PAYROLL_USER_PASSWORD: seedPassword.default('HrPayrollUser123!'),
    SEED_HR_PAYROLL_MANAGER_USERNAME: seedUsername.default('hr.payroll.manager'),
    SEED_HR_PAYROLL_MANAGER_PASSWORD: seedPassword.default('HrPayrollManager123!'),
    SEED_ADMIN_USERNAME: seedUsername.default('admin'),
    SEED_ADMIN_PASSWORD: seedPassword.default('Admin123!'),
  })
  .superRefine((value, ctx) => {
    if ((value.SMTP_USER === undefined) !== (value.SMTP_PASS === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: value.SMTP_USER === undefined ? ['SMTP_USER'] : ['SMTP_PASS'],
        message: 'SMTP_USER and SMTP_PASS must be provided together',
      });
    }
    if (value.SMTP_HOST && !value.MAIL_FROM) {
      ctx.addIssue({ code: 'custom', path: ['MAIL_FROM'], message: 'MAIL_FROM is required when SMTP_HOST is configured' });
    }

    const seedUsernames = [
      ['SEED_EMPLOYEE_USERNAME', value.SEED_EMPLOYEE_USERNAME],
      ['SEED_HR_MANAGER_USERNAME', value.SEED_HR_MANAGER_USERNAME],
      ['SEED_HR_PAYROLL_USER_USERNAME', value.SEED_HR_PAYROLL_USER_USERNAME],
      ['SEED_HR_PAYROLL_MANAGER_USERNAME', value.SEED_HR_PAYROLL_MANAGER_USERNAME],
      ['SEED_ADMIN_USERNAME', value.SEED_ADMIN_USERNAME],
    ] as const;
    const seen = new Set<string>();
    for (const [key, username] of seedUsernames) {
      const normalized = username.toLocaleLowerCase('en-US');
      if (seen.has(normalized)) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'Seed usernames must be unique (case-insensitive)' });
      }
      seen.add(normalized);
    }
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
