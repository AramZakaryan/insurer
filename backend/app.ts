import express from 'express';
import type { ErrorRequestHandler, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  eventSchema,
  failSchema,
  finishSchema,
  paymentSchema,
  recordSchema,
  signOffSchema,
  threadSchema,
} from '../shared/contracts.ts';
import type { ClaimEvent } from '../shared/contracts.ts';
import { ApiError, Store } from './store.ts';

export type DispatchRun = (claimId: string, threadId: string) => Promise<void>;
export function createApp(
  store: Store,
  dispatch: DispatchRun,
  frontendDir: string,
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  const operations: {
    operation_id: string;
    method: string;
    path: string;
    description: string;
    body: unknown;
  }[] = [];
  function route<S extends z.ZodType>(
    method: 'get' | 'post',
    path: string,
    operation_id: string,
    description: string,
    schema: S,
    handler: (
      req: Request,
      res: Response,
      body: z.infer<S>,
    ) => void | Promise<void>,
  ) {
    operations.push({
      operation_id,
      method: method.toUpperCase(),
      path,
      description,
      body: z.toJSONSchema(schema),
    });
    app[method](path, (req, res) =>
      handler(req, res, schema.parse(method === 'get' ? {} : req.body)),
    );
  }
  const empty = z.object({}).strict();
  const id = (req: Request) => String(req.params.id);
  route(
    'get',
    '/api/health',
    'health',
    'Check that the backend is running.',
    empty,
    (_req, res) => {
      res.json({ status: 'ok' });
    },
  );
  route(
    'get',
    '/api/operations',
    'list_operations',
    'List the API operations and their required inputs.',
    empty,
    (_req, res) => {
      res.json(operations);
    },
  );
  route(
    'get',
    '/api/claims',
    'list_claims',
    'Read the claims queue with current decisions and payment status.',
    empty,
    (_req, res) => {
      res.json(store.list());
    },
  );
  route(
    'get',
    '/api/claims/:id',
    'get_claim',
    'Read one claim and its processing state.',
    empty,
    (req, res) => {
      res.json(store.detail(id(req)));
    },
  );
  route(
    'get',
    '/api/claims/:id/history',
    'get_claim_history',
    'Read other claims belonging to this customer.',
    empty,
    (req, res) => {
      res.json(store.history(id(req)));
    },
  );
  route(
    'get',
    '/api/policies/:id',
    'get_policy',
    'Read the customer policy record.',
    empty,
    (req, res) => {
      res.json(store.policy(id(req)));
    },
  );
  route(
    'get',
    '/api/instructions',
    'get_instructions',
    'Read agent instructions and the policy wording.',
    empty,
    (_req, res) => {
      res.json(store.instructions());
    },
  );
  route(
    'get',
    '/api/claims/:id/events',
    'get_events',
    'Read the persisted processing history for a claim.',
    empty,
    (req, res) => {
      res.json(store.eventList(id(req)));
    },
  );
  route(
    'get',
    '/api/claims/:id/stream',
    'stream_events',
    'Stream processing events and replay the saved history.',
    empty,
    (req, res) => {
      const claimId = id(req);
      const history = store.eventList(claimId);
      res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();
      const send = (event: ClaimEvent) =>
        res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
      store.events.on(claimId, send);
      for (const event of history) send(event);
      const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15000);
      heartbeat.unref();
      req.on('close', () => {
        clearInterval(heartbeat);
        store.events.off(claimId, send);
      });
    },
  );
  route(
    'post',
    '/api/claims/:id/run',
    'run_claim',
    'Start an agent run for a waiting claim.',
    threadSchema,
    async (req, res, body) => {
      const view = store.detail(id(req));
      if (view.status !== 'waiting')
        throw new ApiError(409, 'Claim is already processing or decided.');
      await dispatch(id(req), body.thread_id);
      res.status(202).json({ thread_id: body.thread_id });
    },
  );
  route(
    'post',
    '/api/claims/:id/start',
    'start_run',
    'Atomically claim a waiting item for an agent run.',
    threadSchema,
    (req, res, body) => {
      res.json(store.begin(id(req), body.thread_id));
    },
  );
  route(
    'post',
    '/api/claims/:id/decision',
    'record_decision',
    'Record a decision without making a payment.',
    recordSchema,
    (req, res, { thread_id, ...decision }) => {
      res.json(store.record(id(req), thread_id, decision));
    },
  );
  route(
    'post',
    '/api/claims/:id/sign-off',
    'sign_off',
    'Approve the exact current decision as a handler.',
    signOffSchema,
    (req, res, body) => {
      res.json(store.signOff(id(req), body.handler, body.revision));
    },
  );
  route(
    'post',
    '/api/claims/:id/pay',
    'pay_claim',
    'Simulate the approved payment after enforcing sign-off.',
    paymentSchema,
    (req, res, body) => {
      res.json(store.pay(id(req), body.thread_id, body.amount, body.revision));
    },
  );
  route(
    'post',
    '/api/claims/:id/events',
    'record_event',
    'Append a tool or model event to the active run.',
    eventSchema,
    (req, res, body) => {
      store.active(id(req), body.thread_id);
      res.json(store.log(id(req), body.thread_id, body.kind, body.data));
    },
  );
  route(
    'post',
    '/api/claims/:id/finish',
    'finish_run',
    'Finish a run with its decision and usage totals.',
    finishSchema,
    (req, res, body) => {
      res.json(store.finish(id(req), body.thread_id, body.usage));
    },
  );
  route(
    'post',
    '/api/claims/:id/fail',
    'fail_run',
    'Record a failed run and release an undecided claim for retry.',
    failSchema,
    (req, res, body) => {
      res.json(store.fail(id(req), body.thread_id, body.error));
    },
  );
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API operation not found.' });
  });
  if (existsSync(join(frontendDir, 'index.html'))) {
    app.use(express.static(frontendDir));
    app.get('/{*path}', (_req, res) =>
      res.sendFile(join(frontendDir, 'index.html')),
    );
  }
  const onError: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof z.ZodError) {
      res.status(422).json({ error: 'Invalid request.', issues: error.issues });
      return;
    }
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid JSON.' });
      return;
    }
    console.error(
      'Backend request failed:',
      error instanceof Error ? error.message : String(error),
    );
    res
      .status(500)
      .json({ error: 'Backend request failed. Check the server logs.' });
  };
  app.use(onError);
  return app;
}
