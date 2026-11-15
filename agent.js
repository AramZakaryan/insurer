import { createAgent } from 'langchain';
import { luna } from './langchain-chat.js';
import { getPolicy, recordDecision } from './tools.js';
import { AGENT_SYSTEM_PROMPT } from './prompt.js';

export const agent = createAgent({
  model: luna,
  tools: [getPolicy, recordDecision],
  systemPrompt: AGENT_SYSTEM_PROMPT,
});
