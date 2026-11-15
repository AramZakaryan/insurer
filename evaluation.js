import { decide } from './decisions.js';

export function isRight(answer, label) {
  return answer.decision === label.decision && Math.abs(answer.payout - label.payout) <= 1;
}

export async function run(model, effort, claims, labels) {
  const results = [];

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
    ? results.reduce((total, result) => total + result.cost, 0)
    : null;
  const seconds = results.reduce((total, result) => total + result.seconds, 0);
  const costText = cost === null ? 'unknown cost' : `$${cost.toFixed(4)}`;

  console.log(`${model} at ${effort}: ${right} of ${results.length} right for ${costText} in ${seconds.toFixed(0)} seconds`);
  return results;
}
