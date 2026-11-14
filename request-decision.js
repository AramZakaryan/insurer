import { zodResponseFormat } from 'openai/helpers/zod';
import { ClaimDecision } from './claim-decision.js';

const MAX_ATTEMPTS = 3;

export async function requestDecision(client, { model, effort, messages }, onRetry = console.warn) {
  const usage = { cost: 0, input_tokens: 0, output_tokens: 0 };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    // Read the raw completion so failed validation does not discard its billed usage.
    const response = await client.chat.completions.create({
      model,
      messages,
      response_format: zodResponseFormat(ClaimDecision, 'claim_decision'),
      reasoning_effort: effort,
      max_tokens: 4096,
      provider: { require_parameters: true, sort: 'price' },
    });

    for (const [field, source] of [
      ['cost', 'cost'],
      ['input_tokens', 'prompt_tokens'],
      ['output_tokens', 'completion_tokens'],
    ]) {
      const value = response.usage?.[source];
      usage[field] = usage[field] !== null && Number.isFinite(value)
        ? usage[field] + value
        : null;
    }

    const choice = response.choices[0];
    if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') {
      throw new Error('The model refused to decide this claim.');
    }

    let answer;
    let failure;
    let validationIssues;
    if (choice?.finish_reason === 'length') {
      failure = 'The response reached the 4096-token output limit.';
    } else if (choice?.finish_reason !== 'stop') {
      throw new Error(`Unexpected finish reason: ${choice?.finish_reason ?? 'missing'}.`);
    } else {
      try {
        const parsed = JSON.parse(choice.message.content);
        const validated = ClaimDecision.safeParse(parsed);
        if (validated.success) answer = validated.data;
        else {
          failure = 'The JSON does not match the ClaimDecision schema.';
          validationIssues = validated.error.issues;
        }
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        failure = 'The response is not valid JSON.';
      }
    }

    if (answer) return { answer, ...usage, attempts: attempt };
    const diagnostic = JSON.stringify({
      attempt,
      response,
      validation_issues: validationIssues,
    }, null, 2);
    const exhausted = attempt === MAX_ATTEMPTS;
    onRetry(`${failure}\n${diagnostic}\n${exhausted
      ? `No valid decision after ${MAX_ATTEMPTS} attempts.`
      : `Retrying (${attempt + 1}/${MAX_ATTEMPTS}).`}`);
    if (exhausted) {
      throw new Error(`${failure} No valid decision after ${MAX_ATTEMPTS} attempts.`);
    }
  }
}
