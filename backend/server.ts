import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.ts';
import { createApp } from './app.ts';
import { createRunner } from '../agent/run.ts';

const filename =
  process.env.DATABASE_PATH ??
  fileURLToPath(new URL('../outputs/insurer.sqlite', import.meta.url));
mkdirSync(dirname(filename), { recursive: true });
const store = new Store(
  filename,
  process.env.SEED_DIR ?? fileURLToPath(new URL('../data/', import.meta.url)),
);
const port = Number(process.env.PORT ?? 3001);
const testMode = process.env.PILOT_STUB === '1';
if (testMode && process.env.NODE_ENV !== 'test')
  throw new Error('PILOT_STUB requires NODE_ENV=test.');
const makeModel = testMode
  ? () =>
      import('../tests/stub-model.ts').then(({ StubModel }) => new StubModel())
  : null;
const runner = async (claimId: string, threadId: string) => {
  const apiKey = process.env.OPENROUTER_API_KEY ?? '';
  const model = makeModel ? await makeModel() : undefined;
  // Configuration failures are recorded like model failures so the queue stays usable.
  if (!testMode && !apiKey) {
    const begun = store.begin(claimId, threadId);
    if (begun.created)
      store.fail(
        claimId,
        threadId,
        'Set OPENROUTER_API_KEY in .env and restart the backend before retrying.',
      );
    return;
  }
  return createRunner({
    baseUrl: `http://127.0.0.1:${port}`,
    modelName: process.env.MODEL_NAME ?? 'openai/gpt-6-luna',
    apiKey,
    createModel: model ? () => model : undefined,
  })(claimId, threadId);
};
const app = createApp(
  store,
  runner,
  fileURLToPath(new URL('../dist/frontend/', import.meta.url)),
);
const server = app.listen(port, '127.0.0.1', () =>
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
