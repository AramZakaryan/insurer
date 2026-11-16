import { z } from 'zod';

export const ClaimDecision = z.object({
  rationale: z.string().describe(
    '2-3 sentences to explain the decision along with the relevant section of the policy',
  ),
  decision: z.enum(['approve', 'decline', 'refer']),
  payout: z.number().describe(
    'The amount to pay in US dollars, or 0 for a decline or a referral',
  ),
}).describe("A claims handler's decision on one claim.");
