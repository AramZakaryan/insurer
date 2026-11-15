import { getSampleData } from './data.js';
import { run } from './evaluation.js';
import { pivotScores, summarizeScores, summarizeConfidence } from './scores.js';
import { showMisses } from './show-misses.js';
import { decideWithJev } from './jev.js';

const { claims, labels } = getSampleData();

try {
  const first = await decideWithJev(claims[0], labels);
  console.log(first);

  const luna_low = await run('openai/gpt-6-luna', 'low', claims, labels);
//   const luna_medium = await run('openai/gpt-6-luna', 'medium', claims, labels);
//   const gemini = await run('google/gemini-3.5-flash-lite', 'low', claims, labels);
//
//   const scored = [...luna_low, ...luna_medium, ...gemini];
//   console.table(pivotScores(scored));
//   console.table(summarizeScores(scored));
//   showMisses(luna_low, labels);


  const jev = [first];
  for (const claim of claims.slice(1)) {
    jev.push(await decideWithJev(claim, labels));
  }

  const luna_decisions_right = luna_low.filter(
    (result) => result.decision === labels[result.claim_id].decision,
  ).length;
  const jevRight = jev.filter((result) => result.right).length;
  const jevCost = jev.every((result) => result.cost !== null)
    ? `$${jev.reduce((sum, result) => sum + result.cost, 0).toFixed(4)}`
    : 'unknown cost';
  const jevSeconds = jev.reduce((sum, result) => sum + result.seconds, 0);

  console.log(`Jev: ${jevRight} of ${jev.length} decisions right for ${jevCost} in ${jevSeconds.toFixed(0)} seconds`);
  console.log(`Luna at low: ${luna_decisions_right} of ${luna_low.length} decisions right`);

  for (const result of jev) {
    result.confident = result.confidence >= 0.9;
  }
  console.table(summarizeConfidence(jev));

} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
