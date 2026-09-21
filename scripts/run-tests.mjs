import { spawnSync } from 'node:child_process';

const vitestCli = 'node_modules/vitest/vitest.mjs';
const environment = { ...process.env, DATABASE_URL: 'file:./test.db', NODE_ENV: 'test' };

const setup = spawnSync(process.execPath, ['scripts/test-db.mjs'], { stdio: 'inherit', env: environment });
if (setup.status !== 0) process.exit(setup.status ?? 1);

const tests = spawnSync(process.execPath, [vitestCli, 'run'], { stdio: 'inherit', env: environment });
process.exit(tests.status ?? 1);
