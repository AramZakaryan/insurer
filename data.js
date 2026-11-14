import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA = fileURLToPath(new URL('./data/', import.meta.url));

export function load(name) {
  return JSON.parse(readFileSync(join(DATA, name), 'utf8'));
}

export function getSampleData({ tiny = false, heldOut = false } = {}) {
  let claims = load(heldOut ? 'evals/held_out_claims.json' : 'claims.json');
  let decisions = load(heldOut ? 'evals/held_out_decisions.json' : 'evals/decisions.json');

  if (tiny) {
    decisions = decisions.filter((decision) => decision.tiny);
    const chosen = new Set(decisions.map((decision) => decision.claim_id));
    claims = claims.filter((claim) => chosen.has(claim.claim_id));
  }

  const labels = Object.fromEntries(
    decisions.map((decision) => [decision.claim_id, decision]),
  );

  return { claims, labels };
}
