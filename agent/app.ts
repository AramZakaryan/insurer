import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { runRequestSchema } from '../shared/contracts.ts';

export function createAgentApp(
  run: (claimId: string, threadId: string) => Promise<void>,
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.post('/runs', (req, res) => {
    const parsed = runRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(422)
        .json({ error: 'Invalid run request.', issues: parsed.error.issues });
      return;
    }
    const { claim_id, thread_id } = parsed.data;
    void run(claim_id, thread_id).catch((error: unknown) => {
      console.error(
        `Agent run ${thread_id} failed:`,
        error instanceof Error ? error.message : String(error),
      );
    });
    res.status(202).json({ thread_id });
  });
  const invalidBody: ErrorRequestHandler = (error, _req, res, next) => {
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid JSON.' });
      return;
    }
    next(error);
  };
  app.use(invalidBody);
  return app;
}
