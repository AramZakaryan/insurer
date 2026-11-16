import type { Labels, ScoredResult } from './types.ts';
export function showMisses(results: ScoredResult[], labels: Labels) {
  const dollars = (amount: number) => amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  for (const result of results) {
    if (result.right) continue;

    const label = labels[result.claim_id];
    console.log(`**${result.claim_id}, ${label.difficulty}**: ${result.decision} $${dollars(result.payout)}, where the handler said ${label.decision} $${dollars(label.payout)}

- Model: ${result.rationale}
- Handler: ${label.reason}
- Tests: ${label.tests}
`);
  }
}
