import 'dotenv/config';
import { once } from 'node:events';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Store } from '../backend/store.ts';
import { createApp } from '../backend/app.ts';
import { createRunner } from '../agent/run.ts';
import { score, summarize } from './scoring.ts';
import type { Reference, Score } from './scoring.ts';

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey)
  throw new Error('Set OPENROUTER_API_KEY before running the paid evaluation.');
const heldOut = process.argv.includes('--held-out');
const data = fileURLToPath(new URL('../data/', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'insurer-evaluation-'));
// Answer keys stay in this evaluator process; the backend receives claim facts only.
const labels = JSON.parse(
  readFileSync(
    join(
      data,
      heldOut ? 'evals/held_out_decisions.json' : 'evals/decisions.json',
    ),
    'utf8',
  ),
) as (Reference & { claim_id: string })[];
const byId = Object.fromEntries(labels.map((label) => [label.claim_id, label]));
copyFileSync(
  join(data, heldOut ? 'evals/held_out_claims.json' : 'claims.json'),
  join(dir, 'claims.json'),
);
for (const name of ['policies.json', 'policy_wording.md'])
  copyFileSync(join(data, name), join(dir, name));
const store = new Store(join(dir, 'pilot.sqlite'), dir);
const server = createApp(store, async () => {}, '/no-frontend').listen(
  0,
  '127.0.0.1',
);
try {
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Evaluation server did not start.');
  const model = process.env.MODEL_NAME ?? 'openai/gpt-6-luna';
  const run = createRunner({
    baseUrl: `http://127.0.0.1:${address.port}`,
    modelName: model,
    apiKey,
  });
  const results: Score[] = [];
  for (const item of store.list()) {
    const id = item.claim.claim_id;
    const label = byId[id];
    if (!label) throw new Error(`Reference decision missing for ${id}.`);
    let error: string | null = null;
    const started = performance.now();
    try {
      await run(id, randomUUID());
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    const view = store.detail(id);
    results.push({
      claim_id: id,
      difficulty: label.difficulty,
      ...score(error ? null : view.decision, label),
      cost: view.run?.usage?.cost ?? null,
      seconds: (performance.now() - started) / 1000,
      error,
    });
  }
  console.table(
    Object.entries(Object.groupBy(results, (result) => result.difficulty)).map(
      ([difficulty, items]) => ({ difficulty, ...summarize(items ?? []) }),
    ),
  );
  const summary = summarize(results);
  console.log(
    `${model} at low: ${summary.right} of ${summary.claims} right; cost ${summary.cost === null ? 'unknown' : '$' + summary.cost.toFixed(4)}; ${summary.seconds.toFixed(0)} seconds.`,
  );
  const output = new URL(
    `../outputs/evaluation-${Date.now()}.json`,
    import.meta.url,
  );
  mkdirSync(new URL('../outputs/', import.meta.url), { recursive: true });
  writeFileSync(
    output,
    JSON.stringify(
      { model, effort: 'low', held_out: heldOut, summary, results },
      null,
      2,
    ) + '\n',
  );
  console.log(`Saved ${fileURLToPath(output)}`);
} finally {
  server.closeAllConnections();
  server.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
}
