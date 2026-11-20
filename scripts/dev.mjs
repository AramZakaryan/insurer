import 'dotenv/config';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const built = process.argv.includes('--built');
const agentPort = process.env.AGENT_PORT ?? '3002';
const backendPort = process.env.PORT ?? '3001';
const env = {
  ...process.env,
  AGENT_URL: process.env.AGENT_URL ?? `http://127.0.0.1:${agentPort}`,
  BACKEND_URL: process.env.BACKEND_URL ?? `http://127.0.0.1:${backendPort}`,
};
const runtime = ['--import', 'tsx', ...(built ? [] : ['--watch'])];
const commands = [
  [...runtime, 'agent/server.ts'],
  [...runtime, 'backend/server.ts'],
];
if (!built)
  commands.push([
    fileURLToPath(
      new URL('./bin/vite.js', import.meta.resolve('vite/package.json')),
    ),
    '--config',
    'frontend/vite.config.ts',
  ]);

const children = commands.map((args) =>
  spawn(process.execPath, args, { cwd, env, stdio: 'inherit' }),
);
function stop() {
  for (const child of children) child.kill('SIGTERM');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
for (const child of children) {
  child.once('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
    stop();
  });
  child.once('exit', (code) => {
    if (code) process.exitCode = code;
    stop();
  });
}
