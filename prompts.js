import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, load } from './data.js';

export const policies = Object.fromEntries(
  load('policies.json').map((policy) => [policy.policy_id, policy]),
);
export const policyWording = readFileSync(join(DATA, 'policy_wording.md'), 'utf8');

export const INSTRUCTIONS = `You are a claims handler at UnderCover Travel Insurance.
Decide the claim you are given, using the policy wording below and the customer's policy record.

Choose one decision:
- approve: the wording covers the claim and the required documents are attached. Work out the payout using section 10.
- decline: the wording does not cover the claim.
- refer: a colleague needs to look at it, because a required document is missing, or the story and the documents disagree, or the wording does not settle the question.
`;

export const SYSTEM_PROMPT = `${INSTRUCTIONS}\n${policyWording}\n`;

export function makeUserPrompt(claim) {
  const policy = policies[claim.policy_id];
  if (!policy) {
    throw new Error(`Policy record not found: ${claim.policy_id}`);
  }

  return `# Policy record

${JSON.stringify(policy, null, 2)}

# Claim

${JSON.stringify(claim, null, 2)}
`;
}

export function makeMessages(claim) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: makeUserPrompt(claim) },
  ];
}
