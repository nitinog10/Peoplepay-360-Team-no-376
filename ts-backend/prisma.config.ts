import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 6.19.3 (pinned). The connection string lives in `prisma/schema.prisma`
 * as `url = env("DATABASE_URL")`; the config-level `datasource` override is a
 * Prisma 7 feature and is ignored by this CLI version, so it is not set here.
 * `dotenv/config` above is what puts DATABASE_URL in scope — Prisma skips its
 * own .env loading whenever a config file is present.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
