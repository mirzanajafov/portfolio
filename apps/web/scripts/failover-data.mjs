import { readFileSync, writeFileSync } from 'node:fs';

const [runsPath, outPath = 'src/scenes/failover-data.json'] = process.argv.slice(2);
if (!runsPath) {
  console.error(
    'usage: node scripts/failover-data.mjs <portalgun-router>/bench/results/e3/20261009-175756/runs.jsonl',
  );
  process.exit(1);
}

const window = { from: -3000, to: 42000 };
const picks = [
  { id: 'probes', cell: 'crash/probes', label: 'probes only' },
  { id: 'all', cell: 'crash/both-retries', label: 'probes, ejection, retries' },
];

const runs = readFileSync(runsPath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

function extract({ id, cell, label }) {
  const run = runs.find((r) => r.cell === cell && r.report.result.bins);
  if (!run) throw new Error(`no run with bins for ${cell}`);
  const { window: fault, generator, result, events } = run.report;
  const bins = result.bins.filter((b) => b.atMs >= window.from && b.atMs < window.to);
  if (bins.length !== (window.to - window.from) / 100) {
    throw new Error(`${cell}: expected one bin per 100 ms, got ${bins.length}`);
  }
  const failed = bins.reduce((total, b) => total + b.failed, 0);
  if (failed !== result.lost) {
    throw new Error(`${cell}: the bins fail ${failed} requests, the run lost ${result.lost}`);
  }
  return {
    rate: generator.rate,
    clearMs: Math.round((fault.clearAt - fault.injectAt) / 1e6),
    lane: {
      id,
      label,
      events: events.map((e) => ({
        atMs: Math.round((e.unixNano - fault.injectAt) / 1e5) / 10,
        state: e.state,
      })),
      requests: bins.map((b) => b.requests),
      served: bins.map((b) => b.target),
      failed: bins.map((b) => b.failed),
      retried: bins.map((b) => b.retried),
    },
  };
}

const runsUsed = picks.map(extract);
const lanes = runsUsed.map((run) => run.lane);
const data = {
  dimensions: ['a', 'b', 'c'],
  rate: runsUsed[0].rate,
  binMs: 100,
  fromMs: window.from,
  clearMs: runsUsed[0].clearMs,
  lanes,
};

writeFileSync(outPath, `${JSON.stringify(data)}\n`);
console.log(
  `wrote ${outPath}: ${lanes.map((l) => `${l.id} ${l.requests.length} bins, ${l.failed.reduce((a, b) => a + b, 0)} lost`).join('; ')}`,
);
