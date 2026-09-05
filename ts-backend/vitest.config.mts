import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the pure rules only — no database, no HTTP server.
 * The env block pins everything `src/config/env.ts` validates at import time so a
 * test run never depends on a developer's local `.env` (dotenv does not override
 * values that are already set). APP_TIMEZONE and LATE_GRACE_MINUTES are pinned
 * because the attendance and date rules are asserted against them.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'mysql://unit-tests@127.0.0.1:3306/never-connected',
      JWT_ACCESS_SECRET: 'unit-tests-secret-not-used-for-anything-real',
      APP_TIMEZONE: 'Asia/Kolkata',
      LATE_GRACE_MINUTES: '10',
      DEFAULT_CURRENCY: 'INR',
    },
  },
});
