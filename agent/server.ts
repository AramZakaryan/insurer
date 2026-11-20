import 'dotenv/config';
import { createAgentApp } from './app.ts';
import { createRunner } from './run.ts';

const port = Number(process.env.AGENT_PORT ?? 3002);
const testMode = process.env.PILOT_STUB === '1';
if (testMode && process.env.NODE_ENV !== 'test')
  throw new Error('PILOT_STUB requires NODE_ENV=test.');
const createModel = testMode
  ? await import('../tests/stub-model.ts').then(
      ({ StubModel }) =>
        () =>
          new StubModel(),
    )
  : undefined;
const run = createRunner({
  baseUrl:
    process.env.BACKEND_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3001}`,
  modelName: process.env.MODEL_NAME ?? 'openai/gpt-6-luna',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  createModel,
});
const activeRuns = new Set<Promise<void>>();
const app = createAgentApp(async (claimId, threadId) => {
  const job = run(claimId, threadId);
  activeRuns.add(job);
  try {
    await job;
  } finally {
    activeRuns.delete(job);
  }
});
const server = app.listen(port, process.env.AGENT_HOST ?? '127.0.0.1', () =>
  console.log(`Insurer agent listening on port ${port}`),
);
function stop() {
  server.close(() => {
    void Promise.allSettled(activeRuns).then(() => process.exit(0));
  });
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
