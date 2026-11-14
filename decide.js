import { performance } from 'node:perf_hooks';
import { openrouter } from './openrouter.js';
import { requestDecision } from './request-decision.js';
import { makeMessages } from './prompts.js';

export async function decide(claim, model, effort) {
  const start = performance.now();
  try {
    const { answer, cost, input_tokens, output_tokens, attempts } = await requestDecision(
      openrouter,
      { model, effort, messages: makeMessages(claim) },
      (message) => console.warn(`${claim.claim_id} (${model}, ${effort}): ${message}`),
    );

    return {
      model,
      effort,
      technique: 'LLM',
      claim_id: claim.claim_id,
      decision: answer.decision,
      payout: answer.payout,
      rationale: answer.rationale,
      cost,
      input_tokens,
      output_tokens,
      attempts,
      seconds: Math.round((performance.now() - start) / 100) / 10,
    };
  } catch (error) {
    throw new Error(`${claim.claim_id} (${model}, ${effort}): ${error.message}`, { cause: error });
  }
}
