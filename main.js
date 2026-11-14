import { openrouter } from './index.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, getSampleData, load } from './data.js';

const TINY = true;

const { claims, labels } = getSampleData({ tiny: TINY });
const policies = Object.fromEntries(
  load('policies.json').map((policy) => [policy.policy_id, policy]),
);
const policyWording = readFileSync(join(DATA, 'policy_wording.md'), 'utf8');

console.log(`${claims.length} claims, ${Object.keys(labels).length} labels, ${Object.keys(policies).length} policies`);
console.log(`The policy wording is ${policyWording.trim().split(/\s+/u).length.toLocaleString('en-US')} words`);


// const messages = [
//   { role: 'system', content: 'You are a helpful assistant who answers in the style of a pirate.' },
//   { role: 'user', content: 'What is the meaning of the universe?' },
// ];
//
// try {
//   const response = await openrouter.chat.completions.create({
//     model: 'openai/gpt-6-luna',
//     messages,
//   });
//
//   const answer = response.choices[0]?.message.content;
//   if (!answer?.trim()) {
//     throw new Error('No text answer returned by the model.');
//   }
//
//   console.log(answer);
// } catch (error) {
//   console.error(`OpenRouter request failed: ${error.message}`);
//   process.exitCode = 1;
// }
