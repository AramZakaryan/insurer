import type { DecisionsRequest } from '@openrouter/sdk/models';
import dotenv from 'dotenv';
import { OpenRouter } from '@openrouter/sdk';
import { verifyApiKey } from './verify-api-key.ts';

dotenv.config({ override: true, quiet: true });

export async function requestDecisions(payload: DecisionsRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!verifyApiKey(apiKey)) {
    throw new Error('OpenRouter API key is required.');
  }

  const openrouterDecisions = new OpenRouter({
    apiKey,
    serverURL: 'https://openrouter.ai',
    timeoutMs: 60_000,
    retryConfig: { strategy: 'none' },
  });

  return openrouterDecisions.alpha.decisions.create({
    decisionsRequest: payload,
  });
}
