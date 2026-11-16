import { getSampleData } from '../data.ts';

const TINY = false;

const { claims, labels } = getSampleData({ tiny: TINY });
const data = claims.map((claim) => {
  const label = labels[claim.claim_id];

  return {
    claim_id: claim.claim_id,
    summary: claim.summary,
    claim_type: claim.claim_type,
    amount_claimed: claim.amount_claimed,
    difficulty: label.difficulty,
    decision: label.decision,
    payout: label.payout,
  };
});

console.table(data.map((row) => ({
  ...row,
  summary: row.summary.length > 55 ? `${row.summary.slice(0, 52)}...` : row.summary,
})));
