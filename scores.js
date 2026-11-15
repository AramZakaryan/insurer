export function pivotScores(scored) {
  const difficulties = [...new Set(scored.map((result) => result.difficulty))];
  const groups = new Map();

  for (const result of scored) {
    const key = JSON.stringify([result.model, result.effort]);
    if (!groups.has(key)) {
      groups.set(key, {
        model: result.model,
        effort: result.effort,
        ...Object.fromEntries(difficulties.map((difficulty) => [difficulty, null])),
      });
    }

    const row = groups.get(key);
    row[result.difficulty] = (row[result.difficulty] ?? 0) + Number(result.right);
  }

  return [...groups.values()];
}

export function summarizeScores(scored) {
  const groups = new Map();

  for (const result of scored) {
    const key = JSON.stringify([result.model, result.effort]);
    if (!groups.has(key)) {
      groups.set(key, {
        model: result.model,
        effort: result.effort,
        right: 0,
        cost: 0,
        seconds: 0,
      });
    }

    const row = groups.get(key);
    row.right += Number(result.right);
    row.cost = row.cost === null || result.cost === null ? null : row.cost + result.cost;
    row.seconds += result.seconds;
  }

  return [...groups.values()];
}

export function summarizeConfidence(results) {
  const groups = new Map();
  for (const result of results) {
    if (!groups.has(result.confident)) {
      groups.set(result.confident, { confident: result.confident, sum: 0, count: 0 });
    }
    const group = groups.get(result.confident);
    group.sum += Number(result.right);
    group.count += 1;
  }
  return [...groups.values()].sort((a, b) => Number(a.confident) - Number(b.confident));
}
