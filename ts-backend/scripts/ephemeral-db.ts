/**
 * Ephemeral MySQL for development/verification when no MySQL server is installed.
 *
 *   npx tsx scripts/ephemeral-db.ts            # start on port 3307, migrate, verify tables, stop
 *   npx tsx scripts/ephemeral-db.ts --serve    # start on port 3307, migrate, seed, keep running
 *   $env:EPHEMERAL_PORT='0'                    # opt into a random free port in PowerShell
 *
 * With --serve the script prints a DATABASE_URL you can set before `npm run dev`.
 */
import { execSync } from 'node:child_process';
import { createDB } from 'mysql-memory-server';
import mariadb from 'mariadb';

const serve = process.argv.includes('--serve');
/** Port 3307 matches .env; explicitly set EPHEMERAL_PORT=0 for a random free port. */
const fixedPort = Number(process.env.EPHEMERAL_PORT ?? 3307);
if (!Number.isInteger(fixedPort) || fixedPort < 0 || fixedPort > 65535) {
  throw new Error('EPHEMERAL_PORT must be an integer from 0 to 65535');
}

async function main() {
  console.log('Starting ephemeral MySQL 8.4 (first run downloads the binary)...');
  const db = await createDB({ version: '8.4.x', dbName: 'peoplepay360', logLevel: 'WARN', port: fixedPort });
  const url = `mysql://${db.username}@127.0.0.1:${db.port}/${db.dbName}`;
  console.log(`MySQL ${db.mysql.version} ready on port ${db.port}`);
  console.log(`DATABASE_URL=${url}`);

  const env = { ...process.env, DATABASE_URL: url };

  console.log('\n> prisma migrate deploy');
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env });

  const conn = await mariadb.createConnection({
    host: '127.0.0.1',
    port: db.port,
    user: db.username,
    password: '',
    database: db.dbName,
  });
  try {
    const tables = (await conn.query('SHOW TABLES')) as Record<string, string>[];
    const names = tables.map((t) => Object.values(t)[0]).sort();
    console.log(`\nTables (${names.length}):`);
    for (const n of names) console.log('  -', n);
    const migrations = (await conn.query(
      'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at',
    )) as { migration_name: string; finished_at: Date }[];
    console.log('\nApplied migrations:');
    for (const m of migrations) console.log('  -', m.migration_name, '@', m.finished_at?.toISOString());
  } finally {
    await conn.end();
  }

  if (serve) {
    console.log('\n> prisma db seed');
    try {
      execSync('npx prisma db seed', { stdio: 'inherit', env });
    } catch {
      console.warn('Seed failed or not present yet; database is still available.');
    }
    console.log(`\nDatabase is running. In another PowerShell terminal:\n  $env:DATABASE_URL='${url}'\n  npm run dev\nPress Ctrl+C to stop.`);
    await new Promise<void>((resolve) => {
      process.on('SIGINT', () => resolve());
      process.on('SIGTERM', () => resolve());
    });
  }

  await db.stop();
  console.log('\nEphemeral MySQL stopped.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
