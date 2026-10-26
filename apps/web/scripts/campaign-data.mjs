import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [resultsDir, outPath = 'src/scenes/campaign-data.json'] = process.argv.slice(2);
if (!resultsDir) {
  console.error('usage: node scripts/campaign-data.mjs <carwash-ledger>/tools/chaos/results');
  process.exit(1);
}

const campaign = { from: '20261014-225332', to: '20261015-032448' };

const mutants = [
  { id: 'M1', dir: '20261013-061448-M1', guard: 'no unique reference on journals and attempts' },
  { id: 'M2', dir: '20261013-061936-M2', guard: 'no conditional update on payment state' },
  { id: 'M1+M2', dir: '20261013-062122-M1+M2', guard: 'both of the above' },
  { id: 'M3', dir: '20261013-091040-M3', guard: 'no inbox dedupe in the consumers' },
  {
    id: 'M4',
    dir: '20261013-090634-M4',
    guard: 'the relay marks events published before producing them',
  },
  { id: 'M5', dir: '20261013-061256-M5', guard: 'no request hash check on idempotency keys' },
  { id: 'M6', dir: '20261013-063507-M6', guard: "no amount check on the bank's answers" },
  {
    id: 'M7',
    dir: '20261013-062538-M7',
    guard: 'a balance read without its lock and written back',
  },
  { id: 'M7a', dir: '20261011-000810-M7a', guard: 'only FOR UPDATE dropped from the lock' },
  { id: 'M8', dir: '20261013-060438-M8', guard: 'webhooks applied as sent instead of pulled' },
  {
    id: 'M9',
    dir: '20261013-063152-M9',
    guard: 'a snapshot horizon that counts running transactions',
  },
  { id: 'M10', dir: '20261013-123810-M10', guard: 'the settlement journal leaves the fee out' },
  { id: 'M11', dir: '20261013-125835-M11', guard: 'the leaf encoding leaves the reference out' },
  { id: 'M12', dir: '20261013-133213-M12', guard: 'the checkpointer sends the wrong root' },
];

const sum = (values) => Object.values(values).reduce((total, value) => total + value, 0);

function runsOf(dir) {
  const path = join(resultsDir, dir, 'runs.jsonl');
  if (!existsSync(path)) throw new Error(`no runs in ${dir}`);
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const campaignDirs = readdirSync(resultsDir)
  .filter((dir) => /^\d{8}-\d{6}$/.test(dir) && dir >= campaign.from && dir <= campaign.to)
  .sort();
const runs = campaignDirs.flatMap(runsOf).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
const start = Date.parse(runs[0].startedAt);

const data = {
  runs: runs.map((run) => ({
    minute: Math.round((Date.parse(run.startedAt) - start) / 6000) / 10,
    seed: run.seed,
    journeys: run.journeys,
    kills: sum(run.kills.random) + sum(run.kills.failpoints),
    postgres: run.postgres.kills,
    kafka: run.kafka.kills,
    violations: run.violations.length,
  })),
  mutants: mutants.map(({ id, dir, guard }) => {
    const mutantRuns = runsOf(dir);
    const first = mutantRuns.findIndex((run) => run.violations.length > 0);
    const caughtBy =
      first < 0
        ? []
        : [...new Set(mutantRuns[first].violations.map((violation) => violation.id))].sort();
    return {
      id,
      guard,
      runs: mutantRuns.length,
      caughtIn: first < 0 ? null : first + 1,
      caughtBy,
    };
  }),
};

writeFileSync(outPath, `${JSON.stringify(data)}\n`);
const caught = data.mutants.filter((mutant) => mutant.caughtIn !== null);
console.log(
  `wrote ${outPath}: ${data.runs.length} runs from ${campaignDirs.length} folders, ${sum(data.runs.map((run) => run.journeys))} journeys, ${sum(data.runs.map((run) => run.violations))} violations; ${caught.length} of ${data.mutants.length} mutants caught`,
);
