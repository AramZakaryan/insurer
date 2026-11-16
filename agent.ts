import { createAgent } from 'langchain';
import { luna } from './langchain-chat.ts';
import { getPolicy, recordDecision } from './tools.ts';
import { AGENT_SYSTEM_PROMPT } from './prompt.ts';

export const agent = createAgent({
  model: luna,
  tools: [getPolicy, recordDecision],
  systemPrompt: AGENT_SYSTEM_PROMPT,
});
