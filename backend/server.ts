import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.ts';
import { createApp } from './app.ts';
import { createAgentDispatcher } from './agent-client.ts';

const filename =
  process.env.DATABASE_PATH ??
  fileURLToPath(new URL('../outputs/insurer.sqlite', import.meta.url));
mkdirSync(dirname(filename), { recursive: true });
const store = new Store(
  filename,
  process.env.SEED_DIR ?? fileURLToPath(new URL('../data/', import.meta.url)),
);
const port = Number(process.env.PORT ?? 3001);
const dispatch = createAgentDispatcher(
  process.env.AGENT_URL ?? `http://127.0.0.1:${process.env.AGENT_PORT ?? 3002}`,
);
const app = createApp(
  store,
  dispatch,
  fileURLToPath(new URL('../dist/frontend/', import.meta.url)),
);
const server = app.listen(port, process.env.BACKEND_HOST ?? '127.0.0.1', () =>
  console.log(`Insurer: http://127.0.0.1:${port}`),
);
function stop() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
  server.closeAllConnections();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
