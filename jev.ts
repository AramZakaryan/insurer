import { z } from 'zod';
import type { Claim, Labels } from './types.ts';
import type { DecisionsRequest, DecisionsChoiceQuestion } from '@openrouter/sdk/models';
import { performance } from 'node:perf_hooks';
import { getSampleData } from './data.ts';
import { requestDecisions } from './openrouter-decisions.ts';
import { policies, policyWording } from './policies.ts';

export const JEV = 'typesafe/jev-1.13';
export const JEV_QUESTION: DecisionsChoiceQuestion = {
  type: 'choice',
  instructions: "You are a claims handler at UnderCover Travel Insurance. Decide `claim` using `policy_wording` and the customer's `policy` record.",
  criteria: {
    approve: 'The wording covers the claim and the required documents are attached.',
    decline: 'The wording does not cover the claim.',
    refer: 'A colleague needs to look at it, because a required document is missing, or the story and the documents disagree, or the wording does not settle the question.',
  },
};

export interface JevResponse {
  answers?: Record<string, unknown>;
  usage?: { cost?: number };
}
export type JevRequest = (payload: DecisionsRequest) => Promise<JevResponse>;
const choiceSchema = z.object({
  type: z.literal('choice'),
  choice: z.enum(['approve', 'decline', 'refer']),
  confidence: z.number().optional(),
});

const { labels: queueLabels } = getSampleData();

export async function decideWithJev(claim: Claim, labels: Labels = queueLabels, request: JevRequest = requestDecisions) {
  const policy = policies[claim.policy_id];
  if (!policy) throw new Error(`Policy record not found: ${claim.policy_id}`);
  const label = labels[claim.claim_id];
  if (!label) throw new Error(`No reference decision for claim ${claim.claim_id}`);

  const state = { policy_wording: policyWording, policy, claim };
  const start = performance.now();
  try {
    const response = await request({
      model: JEV,
      state,
      questions: { decision: JEV_QUESTION },
    });
    const parsed = choiceSchema.safeParse(response.answers?.decision);
    if (!parsed.success) {
      throw new Error('Jev returned no valid approve, decline, or refer choice.');
    }

    const answer = parsed.data;
    return {
      claim_id: claim.claim_id,
      decision: answer.choice,
      confidence: answer.confidence ?? null,
      right: answer.choice === label.decision,
      cost: response.usage?.cost ?? null,
      seconds: Math.round((performance.now() - start) / 10) / 100,
    };
  } catch (error) {
    throw new Error(`${claim.claim_id} (${JEV}): ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}
