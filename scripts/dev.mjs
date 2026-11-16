import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const children = [
  spawn(process.execPath, ['--import', 'tsx', '--watch', 'backend/server.ts'], {
    cwd,
    stdio: 'inherit',
  }),
  spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL('./bin/vite.js', import.meta.resolve('vite/package.json')),
      ),
      '--config',
      'frontend/vite.config.ts',
    ],
    { cwd, stdio: 'inherit' },
  ),
];
function stop() {
  for (const child of children) child.kill('SIGTERM');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
for (const child of children)
  child.once('exit', (code) => {
    if (code) process.exitCode = code;
    stop();
  });
