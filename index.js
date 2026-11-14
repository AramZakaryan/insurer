import { getSampleData } from './data.js';
import { run } from './evaluation.js';
import { pivotScores, summarizeScores } from './scores.js';
import { showMisses } from './show-misses.js';

const { claims, labels } = getSampleData();

try {
  const luna_low = await run('openai/gpt-6-luna', 'low', claims, labels);
  const luna_medium = await run('openai/gpt-6-luna', 'medium', claims, labels);
  const gemini = await run('google/gemini-3.5-flash-lite', 'low', claims, labels);

  const scored = [...luna_low, ...luna_medium, ...gemini];
  console.table(pivotScores(scored));
  console.table(summarizeScores(scored));
  showMisses(luna_low, labels);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
