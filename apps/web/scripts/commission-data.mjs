import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [labDir, outPath = 'src/scenes/commission-data.json'] = process.argv.slice(2);
if (!labDir) {
  console.error('usage: node scripts/commission-data.mjs <fivefamilies>/bench/results/lab');
  process.exit(1);
}

const replayed = '20261017-seed5-3m';
const threeMinutes = 180e9;
const nodes = 5;
const node = (name) => `(?<${name}>[1-5])`;
const group = (name) => String.raw`\[(?<${name}>[1-5]( [1-5])*)\]`;

const details = {
  kill: new RegExp(`^SIGKILL node ${node('a')}$`),
  'kill-leader': new RegExp(`^SIGKILL node ${node('a')}$`),
  pause: new RegExp(`^pause node ${node('a')}$`),
  isolate: new RegExp(`^isolate node ${node('a')}$`),
  split: new RegExp(String.raw`^split ${group('left')} \| ${group('right')}$`),
  bridge: new RegExp(`^bridge ${node('a')} between ${group('left')} and ${group('right')}$`),
  'one-way': new RegExp(`^one-way ${node('a')} -> ${node('b')}$`),
  netem: new RegExp(
    String.raw`^netem delay (?<delay>\d+)ms (?<jitter>\d+)ms loss (?<loss>\d+)% on node ${node('a')}$`,
  ),
  member: new RegExp(`^remove node ${node('a')}, then add it back as a learner and promote it$`),
  transfer: new RegExp(
    String.raw`^hand leadership from node ${node('a')} to ${node('b')}(?: \(node [1-5] leads after it\))?$`,
  ),
};

const seconds = (ns) => Math.round(ns / 1e7) / 100;
const numbers = (text) => text.split(' ').map(Number);

function parse(fault) {
  const at = `the ${fault.kind} fault at ${seconds(fault.start_ns)} s`;
  if (fault.error) {
    throw new Error(`${at} failed: ${fault.error}`);
  }
  const fields = details[fault.kind]?.exec(fault.detail)?.groups;
  if (!fields) {
    throw new Error(`${at} has a detail the scene can't read: ${fault.detail}`);
  }
  const { a, b, left, right, delay, jitter, loss } = fields;
  return {
    start: seconds(fault.start_ns),
    end: seconds(fault.end_ns),
    kind: fault.kind,
    nodes: [a, b].filter(Boolean).map(Number),
    groups: [left, right].filter(Boolean).map(numbers),
    netem: delay ? { delay: Number(delay), jitter: Number(jitter), loss: Number(loss) } : null,
  };
}

const reportOf = (dir) => JSON.parse(readFileSync(join(labDir, dir, 'report.json'), 'utf8'));
const run = reportOf(replayed);
if (
  run.linearizable !== 'Ok' ||
  !run.states_equal ||
  run.hashes.length !== nodes ||
  new Set(run.hashes).size !== 1
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
  hash: run.hashes[0].slice(0, 8),
  stateIndex: run.state_index,
  leaders: run.leaders.map((entry) => ({
    at: seconds(entry.at_ns),
    node: entry.leader,
    term: entry.term,
  })),
  faults: run.faults.map(parse),
  lab: {
    runs: lab.length,
    faults: lab.reduce((total, report) => total + report.faults.length, 0),
    ops: lab.reduce((total, report) => total + report.ops, 0),
    linearizable: lab.filter((report) => report.linearizable === 'Ok').length,
    sameState: lab.filter((report) => report.states_equal).length,
  },
};

writeFileSync(outPath, `${JSON.stringify(replay)}\n`);
console.log(
  `wrote ${outPath}: ${replay.faults.length} faults and ${replay.leaders.length} leader observations from ${replayed}; ${replay.lab.runs} three-minute runs, ${replay.lab.faults} faults, ${replay.lab.ops} operations, ${replay.lab.linearizable} linearizable`,
);
