import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Claim, Policy } from '../shared/contracts.ts';

export function createFixtures() {
  const dir = mkdtempSync(join(tmpdir(), 'insurer-pilot-'));
  const claims: Claim[] = [
    ['TEST-001', 'Flight delay', 420],
    ['TEST-002', 'Large medical claim', 1500],
    ['TEST-003', 'Decline uncovered expense', 1350],
    ['TEST-004', 'Referral missing receipt', 50],
    ['TEST-005', 'Failure retry case', 10],
  ].map(([id, summary, amount]) => ({
    claim_id: String(id),
    policy_id: 'TEST-POLICY',
    customer_id: 'TEST-CUSTOMER',
    summary: String(summary),
    story: 'Synthetic claim for automated tests.',
    claim_type: 'trip_delay',
    amount_claimed: Number(amount),
    documents: [
      {
        name: 'Test receipt',
        type: 'receipt',
        content: 'Synthetic test document.',
      },
    ],
  }));
  const policies: Policy[] = [
    {
      policy_id: 'TEST-POLICY',
      customer_id: 'TEST-CUSTOMER',
      plan: 'premium',
      travelers: ['Test traveler'],
      status: 'active',
    },
  ];
  writeFileSync(join(dir, 'claims.json'), JSON.stringify(claims));
  writeFileSync(join(dir, 'policies.json'), JSON.stringify(policies));
  writeFileSync(
    join(dir, 'policy_wording.md'),
    '# Test policy\n\nSection 3 covers documented test flight delays.',
  );
  return { dir, claims, policies };
}
