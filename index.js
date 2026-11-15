import { llm } from './langchain-chat.js';
import { getSampleData } from './data.js';
import { run } from './evaluation.js';
import { pivotScores, summarizeScores, summarizeConfidence } from './scores.js';
import { showMisses } from './show-misses.js';
import { decideWithJev } from './jev.js';

const { claims, labels } = getSampleData();

try {
  const messages = [
    { role: 'system', content: 'You are a helpful assistant who answers in the style of a pirate.' },
    { role: 'user', content: 'What is the meaning of the universe?' },
  ];

  const response = await llm.invoke(messages);
  console.log(response.content);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
