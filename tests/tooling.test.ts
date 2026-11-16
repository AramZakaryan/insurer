import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const eslint = new ESLint({ cwd: root });

test('lint rules reject explicit any and unused variables', async () => {
  const [result] = await eslint.lintText(
    'export const value: any = 1;\nconst unused = 2;\n',
    {
      filePath: 'agent/lint-example.ts',
    },
  );
  const rules = result.messages.map((message) => message.ruleId);
  assert.ok(rules.includes('@typescript-eslint/no-explicit-any'));
  assert.ok(rules.includes('@typescript-eslint/no-unused-vars'));
});

test('frontend lint rules reject conditional React hooks', async () => {
  const [result] = await eslint.lintText(
    `
    import { useState } from 'react';
    export function Example({ enabled }: { enabled: boolean }) {
      if (enabled) useState(0);
      return null;
    }
  `,
    { filePath: 'frontend/lint-example.tsx' },
  );
  assert.ok(
    result.messages.some(
      (message) => message.ruleId === 'react-hooks/rules-of-hooks',
    ),
  );
});

test('staged checks format only selected files and fail for lint errors', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'insurer-staged-'));
  const options = {
    cwd: workspace,
    env: {
      ...process.env,
      PATH: `${join(root, 'node_modules', '.bin')}${delimiter}${process.env.PATH ?? ''}`,
    },
    encoding: 'utf8' as const,
    timeout: 20_000,
  };
  const args = [
    fileURLToPath(import.meta.resolve('lint-staged/bin')),
    '--config',
    join(root, 'lint-staged.config.mjs'),
  ];
  try {
    execFileSync('git', ['init', '--quiet'], options);
    copyFileSync(
      join(root, '.prettierrc.json'),
      join(workspace, '.prettierrc.json'),
    );
    writeFileSync(
      join(workspace, 'eslint.config.mjs'),
      `export { default } from ${JSON.stringify(new URL('../eslint.config.mjs', import.meta.url).href)};\n`,
    );
    writeFileSync(
      join(workspace, 'staged sample.ts'),
      'export const value="ready"',
    );
    const untouched = 'const ignored: any=1';
    writeFileSync(join(workspace, 'untouched.ts'), untouched);
    execFileSync('git', ['add', '--', 'staged sample.ts'], options);

    const passed = spawnSync(process.execPath, args, options);
    assert.equal(passed.status, 0, passed.stdout + passed.stderr);
    assert.equal(
      readFileSync(join(workspace, 'staged sample.ts'), 'utf8'),
      "export const value = 'ready';\n",
    );
    assert.equal(
      execFileSync('git', ['show', ':staged sample.ts'], options),
      "export const value = 'ready';\n",
    );
    assert.equal(
      readFileSync(join(workspace, 'untouched.ts'), 'utf8'),
      untouched,
    );

    writeFileSync(
      join(workspace, 'staged sample.ts'),
      'export const value: any = 1;\n',
    );
    execFileSync('git', ['add', '--', 'staged sample.ts'], options);
    const failed = spawnSync(process.execPath, args, options);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stdout + failed.stderr, /no-explicit-any/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
