import assert from 'node:assert/strict';
import test from 'node:test';
import { getPolicy, recordDecision, recorded, tools } from '../tools.js';
import { policies } from '../policies.js';

test('policy tool returns the complete policy as JSON or a not-found message', async () => {
  const policy_id = Object.keys(policies)[0];
  assert.deepEqual(JSON.parse(await getPolicy.invoke({ policy_id })), policies[policy_id]);
  assert.equal(await getPolicy.invoke({ policy_id: 'missing' }), 'There is no policy missing');
  assert.equal(await getPolicy.invoke({ policy_id: 'toString' }), 'There is no policy toString');
  assert.deepEqual(tools.map((item) => item.name), ['get_policy', 'record_decision']);
});

test('decision tool records and overwrites a claim in memory', async (t) => {
  const claim_id = 'test-claim';
  t.after(() => delete recorded[claim_id]);
  const first = { claim_id, decision: 'approve', payout: 420, rationale: 'Covered under section 3.' };
  assert.equal(await recordDecision.invoke(first), 'Recorded approve on test-claim');
  assert.deepEqual(recorded[claim_id], { decision: 'approve', payout: 420, rationale: first.rationale });
  await recordDecision.invoke({ ...first, decision: 'refer', payout: 0 });
  assert.deepEqual(recorded[claim_id], { decision: 'refer', payout: 0, rationale: first.rationale });
});

test('LangChain rejects invalid arguments before recording a decision', async () => {
  const claim_id = 'invalid-test-claim';
  await assert.rejects(recordDecision.invoke({ claim_id, decision: 'unknown', payout: 0, rationale: 'Example' }));
  await assert.rejects(recordDecision.invoke({ claim_id, decision: 'approve', payout: '420', rationale: 'Example' }));
  await assert.rejects(recordDecision.invoke({ claim_id, decision: 'approve', payout: 420 }));
  assert.equal(Object.hasOwn(recorded, claim_id), false);
});
