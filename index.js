import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config({ override: true, quiet: true });

const openrouterApiKey = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

if (!openrouterApiKey) {
  console.error('No OpenRouter API key found. Add OPENROUTER_API_KEY to the .env file');
  process.exit(1);
}

console.log('OpenRouter API key found');

export const openrouter = new OpenAI({
  baseURL: OPENROUTER_BASE_URL,
  apiKey: openrouterApiKey,
  timeout: 120_000,
  maxRetries: 5,
});
