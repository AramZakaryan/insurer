import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { rmSync } from 'node:fs';
import { test } from 'node:test';
import { createAgentApp } from '../agent/app.ts';
import { createAgentDispatcher } from '../backend/agent-client.ts';
import { createApp } from '../backend/app.ts';
import { Store } from '../backend/store.ts';
import { createFixtures } from './fixtures.ts';

test('backend dispatches over HTTP, waits for acceptance only and reports an offline agent', async (t) => {
  const seed = createFixtures();
  const store = new Store(':memory:', seed.dir);
  const releaseRun = Promise.withResolvers<void>();
  const received = Promise.withResolvers<string[]>();
  const agent = createAgentApp(async (claimId, threadId) => {
    received.resolve([claimId, threadId]);
    await releaseRun.promise;
  }).listen(0, '127.0.0.1');
  t.after(() => {
    releaseRun.resolve();
    agent.closeAllConnections();
    agent.close();
    store.close();
    rmSync(seed.dir, { recursive: true, force: true });
  });
  await once(agent, 'listening');
  const agentAddress = agent.address();
  assert.ok(agentAddress && typeof agentAddress !== 'string');
  const agentUrl = `http://127.0.0.1:${agentAddress.port}`;
  const backend = createApp(
    store,
    createAgentDispatcher(agentUrl),
    '/no-frontend',
  ).listen(0, '127.0.0.1');
  t.after(() => {
    backend.closeAllConnections();
    backend.close();
  });
  await once(backend, 'listening');
  const address = backend.address();
  assert.ok(address && typeof address !== 'string');
  const thread_id = randomUUID();
  const post = (url: string, body: unknown) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2000),
    });
  const runUrl = `http://127.0.0.1:${address.port}/api/claims/TEST-001/run`;

  const invalid = await post(agentUrl + '/runs', { thread_id });
  assert.equal(invalid.status, 422);
  const accepted = await post(runUrl, { thread_id });
  assert.equal(accepted.status, 202);
  assert.deepEqual(await accepted.json(), { thread_id });
  assert.deepEqual(await received.promise, ['TEST-001', thread_id]);

  agent.closeAllConnections();
  await new Promise<void>((resolve) => agent.close(() => resolve()));
  const unavailable = await post(runUrl, { thread_id: randomUUID() });
  assert.equal(unavailable.status, 503);
  assert.equal(store.detail('TEST-001').status, 'waiting');
});
