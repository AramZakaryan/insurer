import type { Policy } from './types.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, load } from './data.ts';

export const policies = Object.fromEntries(
  load<Policy[]>('policies.json').map((policy) => [policy.policy_id, policy]),
);
export const policyWording = readFileSync(join(DATA, 'policy_wording.md'), 'utf8');
