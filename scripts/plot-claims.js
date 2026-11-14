import { execFileSync } from 'node:child_process';
import { getSampleData } from '../data.js';
import { plotClaimsByType } from '../charts.js';

const TINY = false;

try {
  const { claims, labels } = getSampleData({ tiny: TINY });
  const data = claims.map((claim) => ({
    claim_type: claim.claim_type,
    decision: labels[claim.claim_id].decision,
  }));

  const chartPath = plotClaimsByType(data);
  console.log(`Claims by type chart: ${chartPath}`);
  execFileSync('open', [chartPath]);
} catch (error) {
  console.error(`Could not display chart: ${error.message}`);
  process.exitCode = 1;
}
