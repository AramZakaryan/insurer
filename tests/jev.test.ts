import type { DecisionsRequest } from '@openrouter/sdk/models';
import type { JevResponse } from '../jev.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { getSampleData } from '../data.ts';
import { decideWithJev, JEV, JEV_QUESTION } from '../jev.ts';
import { policies, policyWording } from '../policies.ts';
import { requestDecisions } from '../openrouter-decisions.ts';

const { claims, labels } = getSampleData();
const claim = claims[0];

function fakeClient(response: JevResponse | Error) {
  const request = async (payload: DecisionsRequest) => {
    request.calls.push(payload);
    if (response instanceof Error) throw response;
    return response;
  };
  request.calls = [] as DecisionsRequest[];
  return request;
}

test('sends claim facts without labels and scores decision alone', async () => {
  const client = fakeClient({
    answers: { decision: { type: 'choice', choice: labels[claim.claim_id].decision, confidence: 0.95 } },
    usage: { cost: 0.0001 },
  });
  const result = await decideWithJev(claim, labels, client);
  assert.deepEqual(client.calls, [{
    model: JEV,
    state: { policy_wording: policyWording, policy: policies[claim.policy_id], claim },
    questions: { decision: JEV_QUESTION },
  }]);
  assert.equal(result.right, true);
  assert.equal(result.confidence, 0.95);
  assert.equal(result.cost, 0.0001);
  assert.equal('payout' in result, false);
  assert.equal('rationale' in result, false);
});

test('marks a different decision wrong and missing usage unknown', async () => {
  const decision = labels[claim.claim_id].decision === 'refer' ? 'decline' : 'refer';
  const client = fakeClient({ answers: { decision: { type: 'choice', choice: decision } } });
  const result = await decideWithJev(claim, labels, client);
  assert.equal(result.right, false);
  assert.equal(result.confidence, null);
  assert.equal(result.cost, null);
});

test('rejects refusals and choices outside the question', async () => {
  for (const answer of [{ type: 'refusal' }, { type: 'choice', choice: 'unknown' }]) {
    const client = fakeClient({ answers: { decision: answer } });
    await assert.rejects(decideWithJev(claim, labels, client), /no valid approve, decline, or refer/);
  }
});

test('rejects missing policy or label before sending a request', async () => {
  const client = fakeClient({});
  await assert.rejects(decideWithJev({ ...claim, policy_id: 'missing' }, labels, client), /Policy record not found/);
  await assert.rejects(decideWithJev(claim, {}, client), /No reference decision/);
  assert.equal(client.calls.length, 0);
});

test('includes claim and model when an API request fails', async () => {
  const error = new Error('402 Insufficient credits');
  await assert.rejects(decideWithJev(claim, labels, fakeClient(error)), (received: unknown) => {
    assert.ok(received instanceof Error);
    assert.ok(received.message.includes(claim.claim_id));
    assert.ok(received.message.includes(JEV));
    assert.equal(received.cause, error);
    return true;
  });
});

test('SDK sends the Decisions endpoint, bearer key, raw body, and abort signal', async (t) => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-key';
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    assert.equal(request.url, 'https://openrouter.ai/api/alpha/decisions');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.get('authorization'), 'Bearer test-key');
    assert.equal(request.headers.get('content-type'), 'application/json');
    assert.ok(request.signal instanceof AbortSignal);
    const body = await request.json();
    assert.equal(body.model, JEV);
    assert.equal(body.decisionsRequest, undefined);
    assert.equal(body.questions.decision.type, 'choice');
    assert.equal(body.state.claim.claim_id, claim.claim_id);
    assert.equal(body.state.labels, undefined);
    return Response.json({
      model: JEV,
      answers: { decision: { type: 'choice', choice: labels[claim.claim_id].decision, confidence: 0.9 } },
      usage: { cost: 0.0001, input_tokens: 3000, output_tokens: 0 },
    });
  });
  const result = await decideWithJev(claim, labels);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(result.confidence, 0.9);
  assert.equal(result.right, true);
});

test('SDK reports HTTP status and server error body', async (t) => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-key';
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'Insufficient credits', code: 402 } }, { status: 402 }));
  await assert.rejects(
    requestDecisions({ model: JEV, state: {}, questions: { decision: JEV_QUESTION } }),
    (error: unknown) => error instanceof Error && 'statusCode' in error && error.statusCode === 402 && error.message.includes('Insufficient credits'),
  );
});
