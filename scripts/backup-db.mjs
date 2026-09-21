import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const source = process.env.DATABASE_FILE ?? 'prisma/dev.db';
if (!existsSync(source)) {
  console.error(`SQLite database not found: ${source}`);
  process.exit(1);
}

mkdirSync('backups', { recursive: true });
const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
const destination = join('backups', `dev-${stamp}.db`);
copyFileSync(source, destination);
console.log(`SQLite backup created: ${destination}`);
