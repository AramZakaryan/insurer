import assert from 'node:assert/strict';
import test from 'node:test';
import { requestDecision } from '../request-decision.js';

const answer = { rationale: 'Section 3 covers this expense.', decision: 'approve', payout: 420 };
const options = { model: 'test-model', effort: 'low', messages: [{ role: 'user', content: 'Test claim' }] };

function completion(content = JSON.stringify(answer), finish_reason = 'stop', usage = { cost: 0.01, prompt_tokens: 100, completion_tokens: 20 }) {
  return { choices: [{ finish_reason, message: { content } }], usage };
}

function fakeClient(responses) {
  const calls = [];
  return {
    calls,
    chat: { completions: { create: async (request) => {
      calls.push(request);
      const next = responses[calls.length - 1];
      if (next instanceof Error) throw next;
      assert.ok(next, 'No unexpected extra requests');
      return next;
    } } },
  };
}

test('retries malformed JSON and counts both billed attempts', async () => {
  const client = fakeClient([completion('{"rationale":'), completion()]);
  const warnings = [];
  const result = await requestDecision(client, options, (message) => warnings.push(message));
  assert.deepEqual(result, { answer, cost: 0.02, input_tokens: 200, output_tokens: 40, attempts: 2 });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /2\/3/);
  assert.equal(client.calls[0].response_format.json_schema.strict, true);
  assert.equal(client.calls[0].provider.require_parameters, true);
  assert.deepEqual(client.calls[0].messages, options.messages);
});

test('retries valid JSON with invalid schema', async () => {
  const client = fakeClient([completion(JSON.stringify({ ...answer, payout: '420' })), completion()]);
  const warnings = [];
  assert.equal((await requestDecision(client, options, (message) => warnings.push(message))).attempts, 2);
  assert.match(warnings[0], /validation_issues/);
  assert.match(warnings[0], /payout/);
  assert.match(warnings[0], /\\"420\\"/);
});

test('rejects permanently invalid output after exactly three attempts', async () => {
  const client = fakeClient([completion(''), completion('bad'), completion('{}')]);
  await assert.rejects(requestDecision(client, options, () => {}), /No valid decision after 3 attempts/);
  assert.equal(client.calls.length, 3);
});

test('retries output truncated by the token limit', async () => {
  const client = fakeClient([completion('{', 'length'), completion()]);
  assert.equal((await requestDecision(client, options, () => {})).attempts, 2);
});

test('does not retry refusals or content filtering', async () => {
  for (const response of [
    { choices: [{ finish_reason: 'stop', message: { refusal: 'Refused' } }] },
    completion('', 'content_filter'),
  ]) {
    const client = fakeClient([response]);
    await assert.rejects(requestDecision(client, options), /refused/);
    assert.equal(client.calls.length, 1);
  }
});

test('does not add application retries for API failures', async () => {
  const error = Object.assign(new Error('Insufficient credits'), { status: 402 });
  const client = fakeClient([error]);
  await assert.rejects(requestDecision(client, options), (received) => received === error);
  assert.equal(client.calls.length, 1);
});

test('keeps cost unknown when any attempt omits cost', async () => {
  const client = fakeClient([completion('bad', 'stop', { prompt_tokens: 100, completion_tokens: 20 }), completion()]);
  const result = await requestDecision(client, options, () => {});
  assert.equal(result.cost, null);
  assert.equal(result.input_tokens, 200);
});

test('does not accept tool calls as final claim decisions', async () => {
  const client = fakeClient([completion('', 'tool_calls')]);
  await assert.rejects(requestDecision(client, options), /Unexpected finish reason/);
  assert.equal(client.calls.length, 1);
});
