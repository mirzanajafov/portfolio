import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { readJson } from './read-json.ts';

const [seriesPath, outPath = 'src/scenes/storm-data.json'] = process.argv.slice(2);
if (!seriesPath) {
  console.error(
    'usage: node scripts/storm-data.ts <poof>/packages/sim/results/server/raw/series.json',
  );
  process.exit(1);
}

const minute = 60_000;
const span = { from: 15 * minute, to: 40 * minute };
const smoothing = 15;
const picks = [
  { id: 'box', policy: 'box', label: 'the box, no budget' },
  { id: 'pool', policy: 'pool-10', label: 'pool, 10 images at a time' },
];

const seriesSchema = z.array(
  z.object({
    machine: z.string(),
    scenario: z.string(),
    policy: z.string(),
    samples: z.array(
      z.object({
        t: z.number(),
        processes: z.number(),
        running: z.number(),
        goodput: z.number(),
        spawns: z.number(),
        backlogMs: z.number(),
      }),
    ),
  }),
);

const series = readJson(seriesPath, seriesSchema);

function extract({ id, policy, label }: (typeof picks)[number]) {
  const line = series.find(
    (s) => s.machine === 'cage' && s.scenario === 'burst' && s.policy === policy,
  );
  if (!line) {
    throw new Error(`no cage/burst series for ${policy}`);
  }
  const smoothed = line.samples.map((sample, i) => {
    const recent = line.samples.slice(Math.max(0, i - smoothing + 1), i + 1);
    return { sample, goodput: recent.reduce((sum, s) => sum + s.goodput, 0) / recent.length };
  });
  const firstIndex = smoothed.findIndex(({ sample }) => sample.t > span.from);
  if (firstIndex < 0) {
    throw new Error(`no ${policy} samples after minute ${span.from / minute}`);
  }
  const inSpan = smoothed.slice(firstIndex).filter(({ sample }) => sample.t <= span.to);
  const spawnsBefore = line.samples[firstIndex - 1]?.spawns ?? 0;
  return {
    id,
    label,
    processes: inSpan.map(({ sample }) => sample.processes),
    running: inSpan.map(({ sample }) => sample.running),
    goodput: inSpan.map(({ goodput }) => Math.round(goodput * 100) / 100),
    spawns: inSpan.map(({ sample }) => sample.spawns - spawnsBefore),
    backlogSeconds: inSpan.map(({ sample }) => Math.round(sample.backlogMs / 1000)),
  };
}

const data = {
  machine: { cores: 1.5, processLimit: 35 },
  startMinute: span.from / minute,
  burst: { from: 20, to: 25, load: 1.5 },
  baseLoad: 0.5,
  policies: picks.map(extract),
};

writeFileSync(outPath, `${JSON.stringify(data)}\n`);
console.log(
  `wrote ${outPath}: ${data.policies.map((p) => `${p.id} over ${p.processes.length} s with a peak of ${Math.max(...p.processes)} processes and ${p.spawns.at(-1) ?? 0} spawns`).join(', ')}`,
);
