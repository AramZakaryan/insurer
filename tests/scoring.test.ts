import assert from 'node:assert/strict';
import test from 'node:test';
import { score, summarize } from '../scripts/scoring.ts';

test('evaluation requires matching decision and payout within one dollar', () => {
  const label = {
    decision: 'approve' as const,
    payout: 420,
    difficulty: 'routine',
  };
  assert.deepEqual(
    score({ decision: 'approve', payout: 421, rationale: 'Covered.' }, label),
    { decision_right: true, right: true },
  );
  assert.deepEqual(
    score(
      { decision: 'approve', payout: 421.01, rationale: 'Covered.' },
      label,
    ),
    { decision_right: true, right: false },
  );
  assert.deepEqual(score(null, label), { decision_right: false, right: false });
  assert.equal(
    score({ decision: 'refer', payout: 0, rationale: 'Uncertain.' }, label)
      .right,
    false,
  );
});
test('missing cost remains unknown in aggregate results', () => {
  assert.equal(
    summarize([
      {
        claim_id: '1',
        difficulty: 'hard',
        right: true,
        decision_right: true,
        cost: null,
        seconds: 1,
        error: null,
      },
      {
        claim_id: '2',
        difficulty: 'hard',
        right: false,
        decision_right: true,
        cost: 0.2,
        seconds: 2,
        error: null,
      },
    ]).cost,
    null,
  );
});
