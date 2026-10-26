import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const [labDir, outPath = 'src/scenes/commission-data.json'] = process.argv.slice(2);
if (!labDir) {
  console.error('usage: node scripts/commission-data.ts <fivefamilies>/bench/results/lab');
  process.exit(1);
}

const replayed = '20261017-seed5-3m';
const threeMinutes = 180e9;
const nodes = 5;
const node = (name: string) => `(?<${name}>[1-5])`;
const group = (name: string) => String.raw`\[(?<${name}>[1-5]( [1-5])*)\]`;

const details = new Map<string, RegExp>([
  ['kill', new RegExp(`^SIGKILL node ${node('a')}$`)],
  ['kill-leader', new RegExp(`^SIGKILL node ${node('a')}$`)],
  ['pause', new RegExp(`^pause node ${node('a')}$`)],
  ['isolate', new RegExp(`^isolate node ${node('a')}$`)],
  ['split', new RegExp(String.raw`^split ${group('left')} \| ${group('right')}$`)],
  ['bridge', new RegExp(`^bridge ${node('a')} between ${group('left')} and ${group('right')}$`)],
  ['one-way', new RegExp(`^one-way ${node('a')} -> ${node('b')}$`)],
  [
    'netem',
    new RegExp(
      String.raw`^netem delay (?<delay>\d+)ms (?<jitter>\d+)ms loss (?<loss>\d+)% on node ${node('a')}$`,
    ),
  ],
  [
    'member',
    new RegExp(`^remove node ${node('a')}, then add it back as a learner and promote it$`),
  ],
  [
    'transfer',
    new RegExp(
      String.raw`^hand leadership from node ${node('a')} to ${node('b')}(?: \(node ${node('after')} leads after it\))?$`,
    ),
  ],
]);

const faultSchema = z.object({
  kind: z.string(),
  detail: z.string(),
  start_ns: z.number(),
  end_ns: z.number(),
  error: z.string().nullish(),
});

const reportSchema = z.object({
  linearizable: z.string(),
  problems: z.array(z.unknown()).nullish(),
  states_equal: z.boolean(),
  hashes: z.array(z.string()).nullish(),
  ops: z.number(),
  state_index: z.number(),
  options: z.object({ duration_ns: z.number() }),
  leaders: z.array(z.object({ at_ns: z.number(), leader: z.number(), term: z.number() })).nullish(),
  faults: z.array(faultSchema).nullish(),
});

type Report = z.infer<typeof reportSchema>;

const seconds = (ns: number) => Math.round(ns / 1e7) / 100;
const numbers = (text: string) => text.split(' ').map(Number);

function parse(fault: z.infer<typeof faultSchema>) {
  const at = `the ${fault.kind} fault at ${seconds(fault.start_ns)} s`;
  if (fault.error) {
    throw new Error(`${at} failed: ${fault.error}`);
  }
  const fields = details.get(fault.kind)?.exec(fault.detail)?.groups;
  if (!fields) {
    throw new Error(`${at} has a detail the scene can't read: ${fault.detail}`);
  }
  const { a, b, left, right, delay, jitter, loss, after } = fields;
  if (after && after !== b) {
    throw new Error(`${at} handed over to node ${b ?? '?'}, but node ${after} led after it`);
  }
  return {
    start: seconds(fault.start_ns),
    end: seconds(fault.end_ns),
    kind: fault.kind,
    nodes: [a, b].filter((value) => value !== undefined).map(Number),
    groups: [left, right].filter((value) => value !== undefined).map(numbers),
    netem: delay ? { delay: Number(delay), jitter: Number(jitter), loss: Number(loss) } : null,
  };
}

const reportOf = (dir: string) =>
  reportSchema.parse(JSON.parse(readFileSync(join(labDir, dir, 'report.json'), 'utf8')));
const passed = (report: Report) => report.linearizable === 'Ok' && !report.problems?.length;
const run = reportOf(replayed);
const hashes = run.hashes ?? [];
const [hash] = hashes;
if (
  !hash ||
  !passed(run) ||
  !run.states_equal ||
  hashes.length !== nodes ||
  new Set(hashes).size !== 1
) {
  throw new Error(`${replayed} did not end linearizable with all ${nodes} nodes at one state`);
}
const lab = readdirSync(labDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(labDir, entry.name, 'report.json')))
  .map((entry) => reportOf(entry.name))
  .filter((report) => report.options.duration_ns === threeMinutes);

const replay = {
  seconds: seconds(run.options.duration_ns),
  ops: run.ops,
  hash: hash.slice(0, 8),
  stateIndex: run.state_index,
  leaders: (run.leaders ?? []).map((entry) => ({
    at: seconds(entry.at_ns),
    node: entry.leader,
    term: entry.term,
  })),
  faults: (run.faults ?? []).map(parse),
  lab: {
    runs: lab.length,
    faults: lab.reduce((total, report) => total + (report.faults ?? []).length, 0),
    ops: lab.reduce((total, report) => total + report.ops, 0),
    linearizable: lab.filter(passed).length,
    sameState: lab.filter((report) => report.states_equal).length,
  },
};

writeFileSync(outPath, `${JSON.stringify(replay)}\n`);
console.log(
  `wrote ${outPath}: ${replay.faults.length} faults and ${replay.leaders.length} leader observations from ${replayed}, ${replay.lab.runs} three-minute runs, ${replay.lab.faults} faults, ${replay.lab.ops} operations, ${replay.lab.linearizable} linearizable`,
);
