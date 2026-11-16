import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const commands = {
  start: ['--import', 'tsx', 'index.ts'],
  langchain: ['--import', 'tsx', 'index.ts'],
  chart: ['--import', 'tsx', 'scripts/plot-claims.ts'],
  table: ['--import', 'tsx', 'scripts/show-table.ts'],
  typecheck: [fileURLToPath(new URL('./bin/tsc', import.meta.resolve('typescript/package.json'))), '--noEmit'],
  test: ['--import', 'tsx', '--test', ...readdirSync(new URL('../tests/', import.meta.url))
    .filter((file) => file.endsWith('.test.ts')).sort().map((file) => `tests/${file}`)],
};
const args = commands[process.argv[2]];
if (!args) throw new Error(`Unknown command: ${process.argv[2]}`);
const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
