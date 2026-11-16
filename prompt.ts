import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { Claim } from './types.ts';
import { policies, policyWording } from './policies.ts';

export const INSTRUCTIONS = `You are a claims handler at UnderCover Travel Insurance.
Decide the claim you are given, using the policy wording below and the customer's policy record.

Choose one decision:
- approve: the wording covers the claim and the required documents are attached. Work out the payout using section 10.
- decline: the wording does not cover the claim.
- refer: a colleague needs to look at it, because a required document is missing, or the story and the documents disagree, or the wording does not settle the question.
`;

export const SYSTEM_PROMPT = `${INSTRUCTIONS}\n${policyWording}\n`;

export const AGENT_SYSTEM_PROMPT = `${INSTRUCTIONS}
Use your tools to look up the customer's policy record and to record your decision.

${policyWording}
`;

export function makeClaimPrompt(claim: Claim) {
  return JSON.stringify(claim, null, 2);
}

export function makeUserPrompt(claim: Claim) {
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

export function makeMessages(claim: Claim): ChatCompletionMessageParam[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: makeUserPrompt(claim) },
  ];
}
