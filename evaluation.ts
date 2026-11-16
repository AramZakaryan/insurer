import type { Claim, Decision, Labels, ReasoningEffort, ScoredResult } from './types.ts';
import { decide } from './decisions.ts';

export function isRight(answer: Pick<Decision, 'decision' | 'payout'>, label: Pick<Decision, 'decision' | 'payout'>) {
  return answer.decision === label.decision && Math.abs(answer.payout - label.payout) <= 1;
}

export async function run(model: string, effort: ReasoningEffort, claims: Claim[], labels: Labels) {
  const results: ScoredResult[] = [];

  for (const claim of claims) {
    const label = labels[claim.claim_id];
    if (!label) {
      throw new Error(`No reference decision for claim ${claim.claim_id}`);
    }

    const answer = await decide(claim, model, effort);
    results.push({ ...answer, difficulty: label.difficulty, right: isRight(answer, label) });
  }

  const right = results.filter((result) => result.right).length;
  const cost = results.every((result) => result.cost !== null)
    ? results.reduce((total, result) => total + (result.cost ?? 0), 0)
    : null;
  const seconds = results.reduce((total, result) => total + result.seconds, 0);
  const costText = cost === null ? 'unknown cost' : `$${cost.toFixed(4)}`;

  console.log(`${model} at ${effort}: ${right} of ${results.length} right for ${costText} in ${seconds.toFixed(0)} seconds`);
  return results;
}
