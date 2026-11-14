import dotenv from 'dotenv';
import OpenAI from 'openai';
import { verifyApiKey } from './verify-api-key.js';

dotenv.config({ override: true, quiet: true });

const openrouterApiKey = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

if (!verifyApiKey(openrouterApiKey)) {
  process.exit(1);
}

export const openrouter = new OpenAI({
  baseURL: OPENROUTER_BASE_URL,
  apiKey: openrouterApiKey,
  timeout: 120_000,
  maxRetries: 5,
});
