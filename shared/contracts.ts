import { z } from 'zod';

export const decisionSchema = z
  .object({
    decision: z.enum(['approve', 'decline', 'refer']),
    payout: z.number().finite().nonnegative().multipleOf(0.01),
    rationale: z.string().trim().min(1),
  })
  .strict();
export type Decision = z.infer<typeof decisionSchema>;
export const claimSchema = z
  .object({
    claim_id: z.string(),
    policy_id: z.string(),
    customer_id: z.string(),
    summary: z.string(),
    story: z.string(),
    claim_type: z.string(),
    amount_claimed: z.number().nonnegative(),
    documents: z.array(
      z.object({ name: z.string(), type: z.string(), content: z.string() }),
    ),
  })
  .passthrough();
export type Claim = z.infer<typeof claimSchema>;
export const policySchema = z
  .object({ policy_id: z.string(), customer_id: z.string() })
  .passthrough();
export type Policy = z.infer<typeof policySchema>;
export type ClaimStatus =
  'waiting' | 'in_progress' | 'waiting_for_sign_off' | 'decided';
export interface RunUsage {
  model: string;
  cost: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  seconds: number;
}
export interface RunRecord {
  thread_id: string;
  status: 'running' | 'completed' | 'failed';
  usage: RunUsage | null;
}
export interface ClaimView {
  claim: Claim;
  status: ClaimStatus;
  decision: Decision | null;
  revision: number;
  signed_by: string | null;
  paid: number | null;
  error: string | null;
  run: RunRecord | null;
}
export interface ClaimEvent {
  id: number;
  claim_id: string;
  thread_id: string;
  kind: string;
  data: unknown;
  created_at: string;
}
export const usageSchema = z
  .object({
    model: z.string().min(1),
    cost: z.number().nonnegative().nullable(),
    input_tokens: z.number().int().nonnegative().nullable(),
    output_tokens: z.number().int().nonnegative().nullable(),
    seconds: z.number().nonnegative(),
  })
  .strict();
export const threadSchema = z.object({ thread_id: z.uuid() }).strict();
export const signOffSchema = z
  .object({
    handler: z.string().trim().min(1),
    revision: z.number().int().positive(),
  })
  .strict();
export const paymentSchema = threadSchema.extend({
  amount: z.number().finite().nonnegative().multipleOf(0.01),
  revision: z.number().int().positive(),
});
export const eventSchema = threadSchema.extend({
  kind: z.enum(['tool_call', 'tool_result', 'model_message']),
  data: z.json(),
});
export const recordSchema = threadSchema.extend(decisionSchema.shape);
export const finishSchema = threadSchema.extend({ usage: usageSchema });
export const failSchema = threadSchema.extend({ error: z.string().min(1) });
