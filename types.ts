import type { z } from 'zod';
import type { ClaimDecision } from './claim-decision.ts';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

export type Decision = z.infer<typeof ClaimDecision>;
export type ReasoningEffort = NonNullable<ChatCompletionCreateParamsNonStreaming['reasoning_effort']>;

export interface Claim {
  claim_id: string;
  policy_id: string;
  summary: string;
  story: string;
  claim_type: string;
  amount_claimed: number;
  [field: string]: unknown;
}

export interface Policy {
  policy_id: string;
  [field: string]: unknown;
}

export interface Label {
  claim_id: string;
  decision: Decision['decision'];
  payout: number;
  difficulty: string;
  reason: string;
  tests: string;
  tiny: boolean;
}

export type Labels = Record<string, Label>;

export interface ModelResult extends Decision {
  model: string;
  effort: ReasoningEffort;
  technique: string;
  claim_id: string;
  cost: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  attempts: number;
  seconds: number;
}

export interface ScoredResult extends ModelResult {
  difficulty: string;
  right: boolean;
}

export interface Score {
  model: string;
  effort: ReasoningEffort;
  right: boolean;
  cost: number | null;
  seconds: number;
}
