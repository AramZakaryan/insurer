import dotenv from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { verifyApiKey } from './verify-api-key.ts';

dotenv.config({ override: true, quiet: true });

const openrouterApiKey = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

if (!verifyApiKey(openrouterApiKey)) {
  throw new Error('OpenRouter API key is required.');
}

export const llm = new ChatOpenAI({
  model: 'openrouter/free',
  apiKey: openrouterApiKey,
  configuration: { baseURL: OPENROUTER_BASE_URL },
  timeout: 120_000,
});

export const luna = new ChatOpenAI({
  model: 'openai/gpt-6-luna',
  apiKey: openrouterApiKey,
  configuration: { baseURL: OPENROUTER_BASE_URL },
  modelKwargs: { reasoning_effort: 'low' },
  timeout: 120_000,
  maxRetries: 5,
});
