import assert from 'node:assert/strict';
import { once } from 'node:events';
import { rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createApp } from '../backend/app.ts';
import { Store } from '../backend/store.ts';
import { createRunner } from '../agent/run.ts';
import { createFixtures } from './fixtures.ts';
import { StubModel } from './stub-model.ts';

test('real LangChain adapter sends low effort, scoped tools and captures OpenRouter usage without network model calls', async (t) => {
  const seed = createFixtures();
  const store = new Store(':memory:', seed.dir);
  const server = createApp(store, async () => {}, '/missing-frontend').listen(
    0,
    '127.0.0.1',
  );
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
    store.close();
    rmSync(seed.dir, { recursive: true, force: true });
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const original = globalThis.fetch;
  const actions = [
    ['get_claim', {}],
    ['get_policy', {}],
    ['get_claim_history', {}],
    [
      'record_decision',
      {
        decision: 'approve',
        payout: 420,
        rationale:
          'Section 3 covers the documented delay. The amount is within the limit.',
      },
    ],
    ['pay_claim', { amount: 420, revision: 1 }],
  ] as const;
  let calls = 0;
  t.mock.method(
    globalThis,
    'fetch',
    async (
      input: Parameters<typeof fetch>[0],
      init: Parameters<typeof fetch>[1],
    ) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!url.startsWith('https://openrouter.ai/'))
        return original(input, init);
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        reasoning_effort: string;
        max_tokens: number;
        messages: {
          role: string;
          content: string | { type: string; text: string }[];
        }[];
      };
      assert.equal(body.model, 'openai/gpt-6-luna');
      assert.equal(body.reasoning_effort, 'low');
      assert.equal(body.max_tokens, 4096);
      assert.equal(
        Array.isArray(body.messages[0].content)
          ? body.messages[0].content.map((part) => part.text).join('')
          : body.messages[0].content,
        `${store.instructions().instructions}\n\n${store.wording}`,
      );
      const action = actions[calls++];
      return Response.json({
        id: `mock-${calls}`,
        object: 'chat.completion',
        created: 1,
        model: body.model,
        choices: [
          {
            index: 0,
            finish_reason: action ? 'tool_calls' : 'stop',
            message: action
              ? {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: `call-${calls}`,
                      type: 'function',
                      function: {
                        name: action[0],
                        arguments: JSON.stringify(action[1]),
                      },
                    },
                  ],
                }
              : {
                  role: 'assistant',
                  content: 'The approved payout was simulated.',
                },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20,
          cost: 0.01,
        },
      });
    },
  );
  const run = createRunner({
    baseUrl: `http://127.0.0.1:${address.port}`,
    modelName: 'openai/gpt-6-luna',
    apiKey: 'test-only',
    timeoutMs: 5000,
  });
  await run('TEST-001', randomUUID());
  assert.equal(calls, 6);
  assert.equal(store.detail('TEST-001').paid, 420);
  const usage = store.detail('TEST-001').run?.usage;
  assert.ok(usage);
  assert.ok(usage.cost !== null && Math.abs(usage.cost - 0.06) < 0.000001);
  assert.equal(usage.input_tokens, 60);
});

test('agent gets facts through HTTP, records decisions, logs steps and cannot bypass payment approval', async (t) => {
  const seed = createFixtures();
  const store = new Store(':memory:', seed.dir);
  const server = createApp(store, async () => {}, '/missing-frontend').listen(
    0,
    '127.0.0.1',
  );
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
    store.close();
    rmSync(seed.dir, { recursive: true, force: true });
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const run = createRunner({
    baseUrl: `http://127.0.0.1:${address.port}`,
    modelName: 'test-stub',
    apiKey: 'not-a-real-key',
    createModel: () => new StubModel(),
  });
  const thread = randomUUID();
  await run('TEST-001', thread);
  await run('TEST-001', thread);
  assert.equal(store.detail('TEST-001').paid, 420);
  assert.equal(store.detail('TEST-001').status, 'decided');
  assert.equal(
    store.eventList('TEST-001').filter((event) => event.kind === 'started')
      .length,
    1,
  );
  assert.ok(
    store.eventList('TEST-001').some((event) => event.kind === 'tool_call'),
  );
  assert.ok(
    store.eventList('TEST-001').some((event) => event.kind === 'tool_result'),
  );
  assert.equal(store.detail('TEST-001').run?.usage?.cost, 0);
  await run('TEST-002', randomUUID());
  assert.equal(store.detail('TEST-002').status, 'waiting_for_sign_off');
  assert.equal(store.detail('TEST-002').paid, null);
  assert.match(
    JSON.stringify(store.eventList('TEST-002')),
    /sign-off is required/,
  );
  await assert.rejects(run('TEST-005', randomUUID()), /Stub model failed/);
  assert.equal(store.detail('TEST-005').status, 'waiting');
  assert.equal(store.detail('TEST-005').run?.status, 'failed');
});
