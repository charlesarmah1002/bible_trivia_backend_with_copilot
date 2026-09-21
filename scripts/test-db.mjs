import { existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const databasePath = 'prisma/test.db';
const journalPath = 'prisma/test.db-journal';
const prismaCli = 'node_modules/prisma/build/index.js';

rmSync(databasePath, { force: true });
rmSync(journalPath, { force: true });

const environment = { ...process.env, DATABASE_URL: 'file:./test.db', NODE_ENV: 'test' };

function run(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], { stdio: 'inherit', env: environment });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(['migrate', 'deploy']);
run(['db', 'seed']);

if (!existsSync(databasePath)) {
  console.error(`Expected test database was not created at ${databasePath}`);
  process.exit(1);
}
