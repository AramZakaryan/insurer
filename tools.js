import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { policies } from './policies.js';

export const recorded = {};

export const getPolicy = tool(
  ({ policy_id }) => {
    const policy = Object.hasOwn(policies, policy_id) ? policies[policy_id] : undefined;
    return policy ? JSON.stringify(policy, null, 2) : `There is no policy ${policy_id}`;
  },
  {
    name: 'get_policy',
    description: "Look up a customer's policy record: the plan, the add-ons, the purchase date, the trip and the travelers.",
    schema: z.object({
      policy_id: z.string(),
    }),
  },
);

export const recordDecision = tool(
  ({ claim_id, decision, payout, rationale }) => {
    recorded[claim_id] = { decision, payout, rationale };
    return `Recorded ${decision} on ${claim_id}`;
  },
  {
    name: 'record_decision',
    description: `Record the decision on a claim in the claims system.
Payout is the amount to pay in US dollars, or 0 for a decline or a referral.
Rationale is 2-3 sentences to explain the decision along with the relevant section of the policy.`,
    schema: z.object({
      claim_id: z.string(),
      decision: z.enum(['approve', 'decline', 'refer']),
      payout: z.number().describe('The amount to pay in US dollars, or 0 for a decline or a referral'),
      rationale: z.string().describe('2-3 sentences to explain the decision along with the relevant section of the policy'),
    }),
  },
);

export const tools = [getPolicy, recordDecision];
