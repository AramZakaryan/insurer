import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const commands = {
  lint: [
    fileURLToPath(
      new URL('./bin/eslint.js', import.meta.resolve('eslint/package.json')),
    ),
    '.',
    '--max-warnings=0',
  ],
  format: [
    fileURLToPath(
      new URL(
        './bin/prettier.cjs',
        import.meta.resolve('prettier/package.json'),
      ),
    ),
    '--write',
    '.',
  ],
  'format:check': [
    fileURLToPath(
      new URL(
        './bin/prettier.cjs',
        import.meta.resolve('prettier/package.json'),
      ),
    ),
    '--check',
    '.',
  ],
  staged: [fileURLToPath(import.meta.resolve('lint-staged/bin'))],
  prepare: [fileURLToPath(new URL('./bin.js', import.meta.resolve('husky')))],
  dev: ['scripts/dev.mjs'],
  build: [
    fileURLToPath(
      new URL('./bin/vite.js', import.meta.resolve('vite/package.json')),
    ),
    'build',
    '--config',
    'frontend/vite.config.ts',
  ],
  e2e: [
    fileURLToPath(
      new URL('./cli.js', import.meta.resolve('@playwright/test/package.json')),
    ),
    'test',
  ],
  browsers: [
    fileURLToPath(
      new URL('./cli.js', import.meta.resolve('@playwright/test/package.json')),
    ),
    'install',
    'chromium',
  ],
  evaluate: [
    '--import',
    'tsx',
    'scripts/evaluate.ts',
    ...process.argv.slice(3),
  ],
  start: ['scripts/dev.mjs', '--built'],
  'start:backend': ['--import', 'tsx', 'backend/server.ts'],
  'start:agent': ['--import', 'tsx', 'agent/server.ts'],
  typecheck: [
    fileURLToPath(
      new URL('./bin/tsc', import.meta.resolve('typescript/package.json')),
    ),
    '--noEmit',
  ],
  test: [
    '--import',
    'tsx',
    '--test',
    ...readdirSync(new URL('../tests/', import.meta.url))
      .filter((file) => file.endsWith('.test.ts'))
      .sort()
      .map((file) => `tests/${file}`),
  ],
};
const command = process.argv[2];
const pipeline =
  command === 'precommit'
    ? ['staged', 'typecheck', 'test', 'build', 'e2e']
    : command === 'check'
      ? ['format:check', 'lint', 'typecheck', 'test', 'build', 'e2e']
      : [command];

for (const step of pipeline) {
  const args = commands[step];
  if (!args) throw new Error(`Unknown command: ${step}`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
