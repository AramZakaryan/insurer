import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFixtures } from '../tests/fixtures.ts';

const seed = createFixtures();
const server = spawn(process.execPath, ['scripts/dev.mjs', '--built'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PILOT_STUB: '1',
    PORT: '3101',
    AGENT_PORT: '3102',
    AGENT_URL: 'http://127.0.0.1:3102',
    BACKEND_URL: 'http://127.0.0.1:3101',
    AGENT_HOST: '127.0.0.1',
    BACKEND_HOST: '127.0.0.1',
    DATABASE_PATH: join(seed.dir, 'pilot.sqlite'),
    SEED_DIR: seed.dir,
  },
});
function stop() {
  server.kill('SIGTERM');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
server.once('exit', (code) => {
  rmSync(seed.dir, { recursive: true, force: true });
  process.exitCode = code ?? 0;
});
