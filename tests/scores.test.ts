import assert from 'node:assert/strict';
import test from 'node:test';
import { pivotScores, summarizeScores, summarizeConfidence } from '../scores.ts';
import type { ScoredResult } from '../types.ts';

function result(overrides: Partial<ScoredResult>): ScoredResult {
  return {
    model: 'test-model', effort: 'low', technique: 'LLM', claim_id: 'TEST-1',
    decision: 'approve', payout: 10, rationale: 'Covered.', difficulty: 'routine',
    right: true, cost: 0.01, seconds: 1, input_tokens: 10, output_tokens: 5,
    attempts: 1, ...overrides,
  };
}

test('groups scores by model and effort while retaining unknown total costs', () => {
  const results = [
    result({}), result({ right: false, cost: null, seconds: 2 }),
    result({ effort: 'medium', cost: 0.03 }),
  ];
  assert.deepEqual(summarizeScores(results), [
    { model: 'test-model', effort: 'low', right: 1, cost: null, seconds: 3 },
    { model: 'test-model', effort: 'medium', right: 1, cost: 0.03, seconds: 1 },
  ]);
});

test('distinguishes wrong answers from difficulties without results', () => {
  assert.deepEqual(pivotScores([
    result({ right: false }), result({ difficulty: 'hard' }),
    result({ effort: 'medium' }),
  ]), [
    { model: 'test-model', effort: 'low', routine: 0, hard: 1 },
    { model: 'test-model', effort: 'medium', routine: 1, hard: null },
  ]);
  assert.deepEqual(summarizeConfidence([
    { confident: true, right: true }, { confident: false, right: false },
    { confident: true, right: false },
  ]), [
    { confident: false, sum: 0, count: 1 },
    { confident: true, sum: 1, count: 2 },
  ]);
});
