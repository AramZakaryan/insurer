import { writeFileSync } from 'node:fs';
import { agent } from './agent.js';
import { getSampleData } from './data.js';
import { makeClaimPrompt } from './prompt.js';
import { recorded } from './tools.js';

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
    if (message.tool_calls?.length) {
      console.dir(message.tool_calls, { depth: null });
    }
    if (message.tool_call_id) {
      console.log(`tool_call_id: ${message.tool_call_id}`);
    }
  }

  console.log('\n=== recorded ===');
  console.dir(recorded, { depth: null });
  console.log('Saved to recorded.json');
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
