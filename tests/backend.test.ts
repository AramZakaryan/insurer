import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { once } from 'node:events';
import { Store } from '../backend/store.ts';
import { createApp } from '../backend/app.ts';
import { createFixtures } from './fixtures.ts';
import { decisionSchema } from '../shared/contracts.ts';
import type { Decision, RunUsage } from '../shared/contracts.ts';

const usage: RunUsage = {
  model: 'stub',
  cost: null,
  input_tokens: 10,
  output_tokens: 10,
  seconds: 1,
};
const approve = (payout: number): Decision => ({
  decision: 'approve',
  payout,
  rationale:
    'Documented expenses are covered under section 3. The plan limit applies.',
});
function fixture(t: test.TestContext) {
  const seed = createFixtures();
  const store = new Store(':memory:', seed.dir);
  t.after(() => {
    store.close();
    rmSync(seed.dir, { recursive: true, force: true });
  });
  return store;
}

test('seed import is idempotent, persists decisions and recovers interrupted runs', (t) => {
  const seed = createFixtures();
  t.after(() => rmSync(seed.dir, { recursive: true, force: true }));
  const filename = join(seed.dir, 'pilot.sqlite');
  let store = new Store(filename, seed.dir);
  const thread = randomUUID();
  store.begin('TEST-001', thread);
  store.record('TEST-001', thread, approve(420));
  store.finish('TEST-001', thread, usage);
  store.begin('TEST-002', randomUUID());
  store.close();
  store = new Store(filename, seed.dir);
  assert.equal(store.list().length, 5);
  assert.equal(store.detail('TEST-001').decision?.payout, 420);
  assert.equal(store.detail('TEST-002').status, 'waiting');
  assert.equal(store.detail('TEST-002').run?.status, 'failed');
  assert.equal(store.eventList('TEST-001').at(-1)?.kind, 'completed');
  store.close();
});

test('only one thread can claim a waiting item and duplicate starts are idempotent', (t) => {
  const store = fixture(t);
  const thread = randomUUID();
  assert.equal(store.begin('TEST-001', thread).created, true);
  assert.equal(store.begin('TEST-001', thread).created, false);
  assert.throws(
    () => store.begin('TEST-001', randomUUID()),
    /already processing/,
  );
  assert.throws(() => store.begin('TEST-002', thread), /another claim/);
  assert.throws(
    () => store.record('TEST-002', thread, approve(1)),
    /not active/,
  );
});

test('1000 needs no sign-off; 1000.01 cannot be paid before exact revision sign-off', (t) => {
  const store = fixture(t);
  for (const [id, amount] of [
    ['TEST-001', 1000],
    ['TEST-002', 1000.01],
  ] as const) {
    const thread = randomUUID();
    store.begin(id, thread);
    store.record(id, thread, approve(amount));
    if (amount > 1000)
      assert.throws(() => store.pay(id, thread, amount, 1), /sign-off/);
    else assert.equal(store.pay(id, thread, amount, 1).paid, 1000);
    store.finish(id, thread, usage);
    if (amount > 1000) {
      assert.equal(store.detail(id).status, 'waiting_for_sign_off');
      assert.throws(
        () => store.signOff(id, 'Reviewer', 2),
        /matching decision/,
      );
      assert.equal(store.signOff(id, 'Reviewer', 1).signed_by, 'Reviewer');
      assert.equal(store.pay(id, thread, amount, 1).paid, 1000.01);
    }
  }
});

test('amount or revision mismatch is blocked and repeated payments do not pay twice', (t) => {
  const store = fixture(t);
  const thread = randomUUID();
  store.begin('TEST-001', thread);
  store.record('TEST-001', thread, approve(420));
  store.record('TEST-001', thread, approve(400));
  assert.throws(
    () => store.pay('TEST-001', thread, 420, 1),
    /current decision/,
  );
  assert.throws(
    () => store.pay('TEST-001', thread, 399, 2),
    /current decision/,
  );
  store.pay('TEST-001', thread, 400, 2);
  store.pay('TEST-001', thread, 400, 2);
  assert.equal(
    store
      .eventList('TEST-001')
      .filter((event) => event.kind === 'payment_simulated').length,
    1,
  );
  assert.throws(
    () => store.record('TEST-001', thread, approve(500)),
    /cannot be changed/,
  );
});

test('declines and referrals enforce zero payout and cannot be paid', (t) => {
  const store = fixture(t);
  for (const [id, decision] of [
    ['TEST-003', 'decline'],
    ['TEST-004', 'refer'],
  ] as const) {
    const thread = randomUUID();
    store.begin(id, thread);
    assert.throws(
      () => store.record(id, thread, { ...approve(1), decision }),
      /zero payout/,
    );
    store.record(id, thread, { ...approve(0), decision });
    store.finish(id, thread, usage);
    assert.equal(store.detail(id).status, 'decided');
    assert.throws(() => store.pay(id, thread, 0, 1), /Only approved/);
  }
  assert.equal(decisionSchema.safeParse(approve(-1)).success, false);
  assert.equal(decisionSchema.safeParse(approve(1.001)).success, false);
});

test('failure releases an undecided claim for a new run, history excludes itself', (t) => {
  const store = fixture(t);
  const thread = randomUUID();
  store.begin('TEST-001', thread);
  store.fail('TEST-001', thread, 'Model unavailable.');
  assert.equal(store.detail('TEST-001').status, 'waiting');
  assert.equal(store.begin('TEST-001', randomUUID()).claim.error, null);
  assert.equal(store.history('TEST-001').length, 4);
  assert.ok(
    store
      .history('TEST-001')
      .every((view) => view.claim.claim_id !== 'TEST-001'),
  );
});

test('HTTP API validates bodies, publishes operation metadata and streams persisted events', async (t) => {
  const store = fixture(t);
  const app = createApp(store, async () => {}, '/missing-frontend');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: unknown) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  assert.equal((await fetch(base + '/api/health')).status, 200);
  assert.equal((await fetch(base + '/api/evals')).status, 404);
  assert.equal((await post('/api/claims/TEST-001/start', {})).status, 422);
  assert.equal(
    (
      await post('/api/claims/TEST-001/start', {
        thread_id: randomUUID(),
        extra: true,
      })
    ).status,
    422,
  );
  assert.equal((await fetch(base + '/api/claims/MISSING')).status, 404);
  const operations = (await (await fetch(base + '/api/operations')).json()) as {
    operation_id: string;
    description: string;
    body: { properties: Record<string, unknown>; required?: string[] };
  }[];
  assert.equal(
    new Set(operations.map((operation) => operation.operation_id)).size,
    operations.length,
  );
  assert.ok(
    operations.every(
      (operation) =>
        operation.description &&
        Object.keys(operation.body.properties).length ===
          (operation.body.required?.length ?? 0),
    ),
  );
  const thread = randomUUID();
  store.begin('TEST-001', thread);
  const abort = new AbortController();
  const stream = await fetch(base + '/api/claims/TEST-001/stream', {
    signal: abort.signal,
  });
  assert.match(stream.headers.get('content-type') ?? '', /text\/event-stream/);
  const reader = stream.body?.getReader();
  assert.ok(reader);
  const chunk = await reader.read();
  assert.match(new TextDecoder().decode(chunk.value), /started/);
  abort.abort();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(store.events.listenerCount('TEST-001'), 0);
});
