import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export function plotClaimsByType(data) {
  const decisions = [...new Set(data.map((row) => row.decision))];
  const traces = decisions.map((decision) => ({
    type: 'histogram',
    name: decision,
    x: data.filter((row) => row.decision === decision).map((row) => row.claim_type),
  }));
  const layout = {
    title: { text: 'Claims by type' },
    barmode: 'relative',
    xaxis: { title: { text: 'Claim type' }, type: 'category' },
    yaxis: { title: { text: 'Number of claims' }, dtick: 1 },
    legend: { title: { text: 'Decision' } },
    margin: { b: 120 },
  };

  const plotly = readFileSync(require.resolve('plotly.js-dist-min'), 'utf8')
    .replace(/<\/script/gi, '<\\/script');
  const chart = JSON.stringify({ traces, layout }).replace(/</g, '\\u003c');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Claims by type</title>
  <style>body { margin: 0; } #chart { width: 100%; height: 90vh; min-height: 500px; }</style>
</head>
<body>
  <div id="chart"></div>
  <script>${plotly}</script>
  <script>
    const chart = ${chart};
    Plotly.newPlot('chart', chart.traces, chart.layout, { responsive: true, displaylogo: false });
  </script>
</body>
</html>
`;

  const output = new URL('./outputs/claims-by-type.html', import.meta.url);
  mkdirSync(new URL('./outputs/', import.meta.url), { recursive: true });
  writeFileSync(output, html, 'utf8');
  return fileURLToPath(output);
}
