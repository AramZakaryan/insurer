import type { Decision } from '../shared/contracts.ts';

export interface Reference {
  decision: Decision['decision'];
  payout: number;
  difficulty: string;
}
export interface Score {
  claim_id: string;
  difficulty: string;
  right: boolean;
  decision_right: boolean;
  cost: number | null;
  seconds: number;
  error: string | null;
}
export function score(answer: Decision | null, reference: Reference) {
  const decision_right = answer?.decision === reference.decision;
  return {
    decision_right,
    right:
      decision_right &&
      answer !== null &&
      Math.abs(answer.payout - reference.payout) <= 1,
  };
}
export function summarize(results: Score[]) {
  return {
    claims: results.length,
    right: results.filter((result) => result.right).length,
    decisions_right: results.filter((result) => result.decision_right).length,
    cost: results.every((result) => result.cost !== null)
      ? results.reduce((total, result) => total + (result.cost ?? 0), 0)
      : null,
    seconds: results.reduce((total, result) => total + result.seconds, 0),
  };
}
