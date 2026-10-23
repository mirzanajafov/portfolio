import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [labDir, outPath = 'src/scenes/commission-data.json'] = process.argv.slice(2);
if (!labDir) {
  console.error('usage: node scripts/commission-data.mjs <fivefamilies>/bench/results/lab');
  process.exit(1);
}

const replayed = '20261017-seed5-3m';
const threeMinutes = 180e9;
const kinds = [
  'kill',
  'kill-leader',
  'pause',
  'isolate',
  'split',
  'bridge',
  'one-way',
  'netem',
  'member',
  'transfer',
];

const reportOf = (dir) => JSON.parse(readFileSync(join(labDir, dir, 'report.json'), 'utf8'));
const seconds = (ns) => Math.round(ns / 1e7) / 100;
const nodesIn = (text) => [...text.matchAll(/\d+/g)].map((match) => Number(match[0]));

function parse(fault) {
  if (fault.error) {
    throw new Error(
      `the ${fault.kind} fault at ${seconds(fault.start_ns)} s failed: ${fault.error}`,
    );
  }
  if (!kinds.includes(fault.kind)) {
    throw new Error(`a ${fault.kind} fault is not one the scene can draw`);
  }
  const netem = /delay (\d+)ms (\d+)ms loss (\d+)% on node (\d+)/.exec(fault.detail);
  return {
    start: seconds(fault.start_ns),
    end: seconds(fault.end_ns),
    kind: fault.kind,
    nodes: netem ? [Number(netem[4])] : nodesIn(fault.detail.replace(/\[[\d ]+\]|\(.*\)/g, '')),
    groups: [...fault.detail.matchAll(/\[([\d ]+)\]/g)].map((match) => nodesIn(match[1])),
    netem: netem
      ? { delay: Number(netem[1]), jitter: Number(netem[2]), loss: Number(netem[3]) }
      : null,
  };
}

const run = reportOf(replayed);
if (run.linearizable !== 'Ok' || !run.states_equal || new Set(run.hashes).size !== 1) {
  throw new Error(`${replayed} did not end linearizable with every node at one state`);
}
const lab = readdirSync(labDir)
  .map(reportOf)
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
