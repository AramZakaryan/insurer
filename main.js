import { openrouter } from './index.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, getSampleData, load } from './data.js';

const TINY = false;

const { claims, labels } = getSampleData({ tiny: TINY });
const policies = Object.fromEntries(
  load('policies.json').map((policy) => [policy.policy_id, policy]),
);
const policyWording = readFileSync(join(DATA, 'policy_wording.md'), 'utf8');

// console.log(`${claims.length} claims, ${Object.keys(labels).length} labels, ${Object.keys(policies).length} policies`);
// console.log(`The policy wording is ${policyWording.trim().split(/\s+/u).length.toLocaleString('en-US')} words`);

const homeAlone = claims.find((claim) => claim.claim_id === 'CLM-1015');
const decision = labels['CLM-1015'];
const payout = decision.payout.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

console.log(`**${homeAlone.summary}**

${homeAlone.story}

**Handler:** ${decision.decision} $${payout}. ${decision.reason}
`);

const { claims: queue, labels: queueLabels } = getSampleData();
const hangover = queue.find((claim) => claim.claim_id === 'CLM-1010');
const hangoverDecision = queueLabels['CLM-1010'];
const hangoverPayout = hangoverDecision.payout.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

console.log(`**${hangover.summary}**

${hangover.story}

**Handler:** ${hangoverDecision.decision} $${hangoverPayout}. ${hangoverDecision.reason}
`);


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
