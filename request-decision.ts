import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { Decision, ReasoningEffort } from './types.ts';
import type { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ClaimDecision } from './claim-decision.ts';

export interface DecisionResponse {
  choices: { finish_reason: string | null; message: { content?: string | null; refusal?: string | null } }[];
  usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number };
}

export interface DecisionRequest {
  model: string;
  messages: ChatCompletionMessageParam[];
  response_format: ReturnType<typeof zodResponseFormat>;
  reasoning_effort: ReasoningEffort;
  max_tokens: number;
  provider: { require_parameters: boolean; sort: string };
}

export interface DecisionClient {
  chat: { completions: { create(request: DecisionRequest): Promise<DecisionResponse> } };
}

interface Usage {
  cost: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
}

interface DecisionOptions {
  model: string;
  effort: ReasoningEffort;
  messages: ChatCompletionMessageParam[];
}

const MAX_ATTEMPTS = 3;

export async function requestDecision(client: DecisionClient, { model, effort, messages }: DecisionOptions, onRetry: (message: string) => void = console.warn): Promise<Usage & { answer: Decision; attempts: number }> {
  const usage: Usage = { cost: 0, input_tokens: 0, output_tokens: 0 };

  for (let attempt = 1; ; attempt += 1) {
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
    ] as const) {
      const value = response.usage?.[source];
      usage[field] = usage[field] !== null && typeof value === 'number' && Number.isFinite(value)
        ? usage[field] + value
        : null;
    }

    const choice = response.choices[0];
    if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') {
      throw new Error('The model refused to decide this claim.');
    }

    let answer: Decision | undefined;
    let failure: string | undefined;
    let validationIssues: z.core.$ZodIssue[] | undefined;
    if (choice?.finish_reason === 'length') {
      failure = 'The response reached the 4096-token output limit.';
    } else if (choice?.finish_reason !== 'stop') {
      throw new Error(`Unexpected finish reason: ${choice?.finish_reason ?? 'missing'}.`);
    } else {
      try {
        const parsed: unknown = JSON.parse(choice.message.content ?? '');
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
