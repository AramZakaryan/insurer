import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { isAIMessage, isToolMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createAgent } from 'langchain';
import { z } from 'zod';
import { decisionSchema } from '../shared/contracts.ts';
import type { ClaimView, Policy, RunUsage } from '../shared/contracts.ts';
import { createClient } from './client.ts';
import { createUsageMeter } from './usage.ts';

export interface AgentOptions {
  baseUrl: string;
  modelName: string;
  apiKey: string;
  createModel?: () => BaseChatModel;
  timeoutMs?: number;
}
export function createRunner(options: AgentOptions) {
  return async function run(claimId: string, threadId: string): Promise<void> {
    const signal = AbortSignal.timeout(options.timeoutMs ?? 120000);
    const api = createClient(options.baseUrl, signal);
    const path = `/api/claims/${encodeURIComponent(claimId)}`;
    const started = await api<{ created: boolean; claim: ClaimView }>(
      `${path}/start`,
      { thread_id: threadId },
    );
    if (!started.created) return;
    const start = performance.now();
    try {
      const config = await api<{
        instructions: string;
        policy_wording: string;
      }>('/api/instructions');
      const claim = started.claim.claim;
      const getClaim = tool(() => api<ClaimView>(path), {
        name: 'get_claim',
        description:
          'Read the current claim, attached documents and processing state.',
        schema: z.object({}).strict(),
      });
      const getPolicy = tool(
        () =>
          api<Policy>(`/api/policies/${encodeURIComponent(claim.policy_id)}`),
        {
          name: 'get_policy',
          description: 'Read the policy record belonging to this claim.',
          schema: z.object({}).strict(),
        },
      );
      const getHistory = tool(() => api<ClaimView[]>(`${path}/history`), {
        name: 'get_claim_history',
        description: 'Read other claims belonging to this customer.',
        schema: z.object({}).strict(),
      });
      const record = tool(
        (args) =>
          api<ClaimView>(`${path}/decision`, { thread_id: threadId, ...args }),
        {
          name: 'record_decision',
          description:
            'Record approve, decline or refer, payout in USD and 2-3 sentences citing relevant policy sections. Declines and referrals have zero payout. Recording does not pay.',
          schema: decisionSchema,
        },
      );
      const pay = tool(
        async (args) => {
          try {
            return await api<ClaimView>(`${path}/pay`, {
              thread_id: threadId,
              ...args,
            });
          } catch (error) {
            return {
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
        {
          name: 'pay_claim',
          description:
            'Simulate the exact approved payout. Use the decision revision returned by record_decision. Payouts over $1,000 are blocked until a human handler signs off.',
          schema: z
            .object({
              amount: z.number().nonnegative().multipleOf(0.01),
              revision: z.number().int().positive(),
            })
            .strict(),
        },
      );
      const meter = createUsageMeter();
      const model =
        options.createModel?.() ??
        new ChatOpenAI({
          model: options.modelName,
          apiKey: options.apiKey,
          configuration: {
            baseURL: 'https://openrouter.ai/api/v1',
            fetch: meter.fetch,
          },
          modelKwargs: { reasoning_effort: 'low' },
          timeout: 120000,
          maxTokens: 4096,
          maxRetries: 2,
        });
      const agent = createAgent({
        model,
        tools: [getClaim, getPolicy, getHistory, record, pay],
        systemPrompt: `${config.instructions}\n\n${config.policy_wording}`,
      });
      let seen = 1;
      const usage: RunUsage = {
        model: options.modelName,
        cost: 0,
        input_tokens: 0,
        output_tokens: 0,
        seconds: 0,
      };
      const stream = await agent.stream(
        {
          messages: [
            {
              role: 'user',
              content: `Process claim ${claimId}. Read its facts using get_claim.`,
            },
          ],
        },
        {
          streamMode: 'values',
          signal,
          recursionLimit: 24,
          configurable: { thread_id: threadId },
        },
      );
      for await (const state of stream) {
        for (const message of state.messages.slice(seen)) {
          if (isAIMessage(message)) {
            const meta = message.usage_metadata;
            usage.input_tokens =
              usage.input_tokens === null || !meta
                ? null
                : usage.input_tokens + meta.input_tokens;
            usage.output_tokens =
              usage.output_tokens === null || !meta
                ? null
                : usage.output_tokens + meta.output_tokens;
            const cost: unknown = message.response_metadata.cost;
            usage.cost =
              usage.cost !== null &&
              typeof cost === 'number' &&
              Number.isFinite(cost)
                ? usage.cost + cost
                : null;
            if (message.content)
              await api(`${path}/events`, {
                thread_id: threadId,
                kind: 'model_message',
                data: { content: message.content },
              });
            for (const call of message.tool_calls ?? [])
              await api(`${path}/events`, {
                thread_id: threadId,
                kind: 'tool_call',
                data: { name: call.name, arguments: call.args },
              });
          } else if (isToolMessage(message))
            await api(`${path}/events`, {
              thread_id: threadId,
              kind: 'tool_result',
              data: { name: message.name ?? 'tool', content: message.content },
            });
        }
        seen = state.messages.length;
      }
      const totals = meter.totals();
      if (totals.requests) {
        usage.cost = totals.cost;
        usage.input_tokens = totals.input_tokens;
        usage.output_tokens = totals.output_tokens;
      }
      usage.seconds = Math.round((performance.now() - start) / 100) / 10;
      await api(`${path}/finish`, { thread_id: threadId, usage });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await createClient(options.baseUrl, AbortSignal.timeout(10000))(
        `${path}/fail`,
        { thread_id: threadId, error: message },
      );
      throw error;
    }
  };
}

export async function run(claim_id: string, thread_id: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey)
    throw new Error(
      'Set OPENROUTER_API_KEY in .env before starting the agent.',
    );
  return createRunner({
    baseUrl: process.env.BACKEND_URL ?? 'http://127.0.0.1:3001',
    modelName: process.env.MODEL_NAME ?? 'openai/gpt-6-luna',
    apiKey,
  })(claim_id, thread_id);
}
