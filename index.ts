import { isAIMessage, isToolMessage } from '@langchain/core/messages';
import { writeFileSync } from 'node:fs';
import { agent } from './agent.ts';
import { getSampleData } from './data.ts';
import { makeClaimPrompt } from './prompt.ts';
import { recorded } from './tools.ts';

const { claims } = getSampleData();

try {
  const result = await agent.invoke({
    messages: [{ role: 'user', content: makeClaimPrompt(claims[0]) }],
  });

  writeFileSync(
    new URL('./recorded.json', import.meta.url),
    `${JSON.stringify(recorded, null, 2)}\n`,
    'utf8',
  );

  for (const message of result.messages.slice(1)) {
    console.log(`\n=== ${message.getType()} ===`);
    console.log(message.content);
    if (isAIMessage(message) && message.tool_calls?.length) {
      console.dir(message.tool_calls, { depth: null });
    }
    if (isToolMessage(message)) {
      console.log(`tool_call_id: ${message.tool_call_id}`);
    }
  }

  console.log('\n=== recorded ===');
  console.dir(recorded, { depth: null });
  console.log('Saved to recorded.json');
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
