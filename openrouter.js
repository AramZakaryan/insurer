import dotenv from 'dotenv';
import OpenAI from 'openai';
import { verifyApiKey } from './verify-api-key.js';

dotenv.config({ override: true, quiet: true });

const apiKey = process.env.OPENROUTER_API_KEY;
if (!verifyApiKey(apiKey)) {
  throw new Error('OpenRouter API key is required.');
}

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey,
  timeout: 120_000,
  maxRetries: 5,
});
