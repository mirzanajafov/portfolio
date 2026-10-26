import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { readJsonLines } from './read-json.ts';

const [runsPath, outPath = 'src/scenes/failover-data.json'] = process.argv.slice(2);
if (!runsPath) {
  console.error(
    'usage: node scripts/failover-data.ts <portalgun-router>/bench/results/e3/20261009-175756/runs.jsonl',
  );
  process.exit(1);
}

const span = { from: -3000, to: 42000 };
const picks = [
  { id: 'probes', cell: 'crash/probes', label: 'probes only' },
  { id: 'all', cell: 'crash/both-retries', label: 'probes, ejection, retries' },
];

const runSchema = z.object({
  cell: z.string(),
  report: z
    .object({
      window: z.object({ injectAt: z.number(), clearAt: z.number() }),
      generator: z.object({ rate: z.number() }),
      result: z.object({
        lost: z.number(),
        bins: z
          .array(
            z.object({
              atMs: z.number(),
              requests: z.number(),
              target: z.number(),
              failed: z.number(),
              retried: z.number(),
            }),
          )
          .nullish(),
      }),
      events: z
        .array(z.object({ unixNano: z.number(), state: z.string(), reason: z.string().optional() }))
        .nullable(),
    })
    .nullable(),
});

const runs = readJsonLines(runsPath, runSchema);

function extract({ id, cell, label }: (typeof picks)[number]) {
  const report = runs.find((run) => run.cell === cell && run.report?.result.bins)?.report;
  const allBins = report?.result.bins;
  if (!report || !allBins) {
    throw new Error(`no run with bins for ${cell}`);
  }
  const { window: fault, generator, result, events } = report;
  if (!events) {
    throw new Error(`${cell}: the run recorded no health events`);
  }
  const bins = allBins.filter((b) => b.atMs >= span.from && b.atMs < span.to);
  if (bins.length !== (span.to - span.from) / 100) {
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
        reason: e.reason,
      })),
      requests: bins.map((b) => b.requests),
      served: bins.map((b) => b.target),
      failed: bins.map((b) => b.failed),
      retried: bins.map((b) => b.retried),
    },
  };
}

const picked = picks.map(extract);
const [first] = picked;
if (!first) {
  throw new Error('no runs were picked');
}
const lanes = picked.map((run) => run.lane);
const data = {
  rate: first.rate,
  binMs: 100,
  fromMs: span.from,
  clearMs: first.clearMs,
  lanes,
};

writeFileSync(outPath, `${JSON.stringify(data)}\n`);
console.log(
  `wrote ${outPath}: ${lanes.map((l) => `${l.id} ${l.requests.length} bins with ${l.failed.reduce((a, b) => a + b, 0)} lost`).join(', ')}`,
);
