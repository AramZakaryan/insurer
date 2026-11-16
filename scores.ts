import type { Score, ScoredResult } from './types.ts';

export function pivotScores(scored: ScoredResult[]) {
  const difficulties = [...new Set(scored.map((result) => result.difficulty))];
  const groups = new Map<string, { model: string; effort: string; values: Record<string, number | null> }>();

  for (const result of scored) {
    const key = JSON.stringify([result.model, result.effort]);
    let row = groups.get(key);
    if (!row) {
      row = {
        model: result.model,
        effort: result.effort,
        values: Object.fromEntries(difficulties.map((difficulty) => [difficulty, null])),
      };
      groups.set(key, row);
    }
    row.values[result.difficulty] = (row.values[result.difficulty] ?? 0) + Number(result.right);
  }

  return [...groups.values()].map(({ model, effort, values }) => ({ model, effort, ...values }));
}

export function summarizeScores(scored: Score[]) {
  const groups = new Map<string, { model: string; effort: string; right: number; cost: number | null; seconds: number }>();

  for (const result of scored) {
    const key = JSON.stringify([result.model, result.effort]);
    let row = groups.get(key);
    if (!row) {
      row = { model: result.model, effort: result.effort, right: 0, cost: 0, seconds: 0 };
      groups.set(key, row);
    }
    row.right += Number(result.right);
    row.cost = row.cost === null || result.cost === null ? null : row.cost + result.cost;
    row.seconds += result.seconds;
  }

  return [...groups.values()];
}

export function summarizeConfidence(results: { confident: boolean; right: boolean }[]) {
  const groups = new Map<boolean, { confident: boolean; sum: number; count: number }>();
  for (const result of results) {
    let group = groups.get(result.confident);
    if (!group) {
      group = { confident: result.confident, sum: 0, count: 0 };
      groups.set(result.confident, group);
    }
    group.sum += Number(result.right);
    group.count += 1;
  }
  return [...groups.values()].sort((a, b) => Number(a.confident) - Number(b.confident));
}
