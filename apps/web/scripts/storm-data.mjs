import { readFileSync, writeFileSync } from 'node:fs';

const [seriesPath, outPath = 'src/scenes/storm-data.json'] = process.argv.slice(2);
if (!seriesPath) {
  console.error(
    'usage: node scripts/storm-data.mjs <poof>/packages/sim/results/server/raw/series.json',
  );
  process.exit(1);
}

const minute = 60_000;
const window = { from: 15 * minute, to: 40 * minute };
const smoothing = 15;
const picks = [
  { id: 'box', policy: 'box', label: 'the box, no budget' },
  { id: 'pool', policy: 'pool-10', label: 'pool, 10 images at a time' },
];

const series = JSON.parse(readFileSync(seriesPath, 'utf8'));

function extract({ id, policy, label }) {
  const line = series.find(
    (s) => s.machine === 'cage' && s.scenario === 'burst' && s.policy === policy,
  );
  if (!line) throw new Error(`no cage/burst series for ${policy}`);
  const smoothed = line.samples.map((_, i) => {
    const slice = line.samples.slice(Math.max(0, i - smoothing + 1), i + 1);
    return slice.reduce((sum, s) => sum + s.goodput, 0) / slice.length;
  });
  const indices = line.samples.flatMap((s, i) =>
    s.t > window.from && s.t <= window.to ? [i] : [],
  );
  const before = line.samples[indices[0] - 1] ?? { spawns: 0 };
  return {
    id,
    label,
    processes: indices.map((i) => line.samples[i].processes),
    running: indices.map((i) => line.samples[i].running),
    goodput: indices.map((i) => Math.round(smoothed[i] * 100) / 100),
    spawns: indices.map((i) => line.samples[i].spawns - before.spawns),
    backlogSeconds: indices.map((i) => Math.round(line.samples[i].backlogMs / 1000)),
  };
}

const data = {
  machine: { cores: 1.5, processLimit: 35 },
  startMinute: window.from / minute,
  burst: { from: 20, to: 25, load: 1.5 },
  baseLoad: 0.5,
  policies: picks.map(extract),
};

writeFileSync(outPath, `${JSON.stringify(data)}\n`);
console.log(
  `wrote ${outPath}: ${data.policies.map((p) => `${p.id} ${p.processes.length} s, peak ${Math.max(...p.processes)} processes, ${p.spawns.at(-1)} spawns`).join('; ')}`,
);
