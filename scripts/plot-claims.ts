import { execFileSync } from 'node:child_process';
import { getSampleData } from '../data.ts';
import { plotClaimsByType, plotClaimsByDifficulty } from '../charts.ts';

const TINY = false;

try {
  const { claims, labels } = getSampleData({ tiny: TINY });
  const data = claims.map((claim) => ({
    claim_type: claim.claim_type,
    decision: labels[claim.claim_id].decision,
    difficulty: labels[claim.claim_id].difficulty,
  }));

  const chartPaths = [plotClaimsByType(data), plotClaimsByDifficulty(data)];
  for (const chartPath of chartPaths) {
    console.log(`Chart: ${chartPath}`);
  }
  execFileSync('open', chartPaths);
} catch (error) {
  console.error(`Could not display chart: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
