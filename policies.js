import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, load } from './data.js';

export const policies = Object.fromEntries(
  load('policies.json').map((policy) => [policy.policy_id, policy]),
);
export const policyWording = readFileSync(join(DATA, 'policy_wording.md'), 'utf8');

