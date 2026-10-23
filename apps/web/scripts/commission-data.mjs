import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [labDir, outPath = 'src/scenes/commission-data.json'] = process.argv.slice(2);
if (!labDir) {
  console.error('usage: node scripts/commission-data.mjs <fivefamilies>/bench/results/lab');
  process.exit(1);
}

const replayed = '20261017-seed5-3m';
const numerals = ['I', 'II', 'III', 'IV', 'V'];

const reportOf = (dir) => JSON.parse(readFileSync(join(labDir, dir, 'report.json'), 'utf8'));
const seconds = (ns) => Math.round(ns / 1e7) / 100;
const family = (node) => numerals[node - 1];
const families = (nodes) =>
  [...nodes]
    .sort((a, b) => a - b)
    .map(family)
    .join(' ');
const nodesIn = (text) => [...text.matchAll(/\d+/g)].map((match) => Number(match[0]));
const across = (a, b) =>
  a.flatMap((x) =>
    b.flatMap((y) => [
      { from: x, to: y },
      { from: y, to: x },
    ]),
  );

function effects(fault, leader) {
  const none = { down: [], frozen: [], out: [], slow: [], blocked: [] };
  const groups = [...fault.detail.matchAll(/\[([\d ]+)\]/g)].map((match) => nodesIn(match[1]));
  const [first, second] = nodesIn(fault.detail);
  switch (fault.kind) {
    case 'kill':
    case 'kill-leader':
      return {
        ...none,
        down: [first],
        text: `SIGKILL family ${family(first)}${first === leader ? ', the Don' : ''}`,
      };
    case 'pause':
      return { ...none, frozen: [first], text: `family ${family(first)} frozen` };
    case 'isolate': {
      const rest = numerals.map((_, index) => index + 1).filter((node) => node !== first);
      return {
        ...none,
        blocked: across([first], rest),
        text: `family ${family(first)} cut off from the rest`,
      };
    }
    case 'split':
      return {
        ...none,
        blocked: across(groups[0], groups[1]),
        text: `split ${families(groups[0])} | ${families(groups[1])}`,
      };
    case 'bridge':
      return {
        ...none,
        blocked: across(groups[0], groups[1]),
        text: `only ${family(first)} links ${families(groups[0])} and ${families(groups[1])}`,
      };
    case 'one-way':
      return {
        ...none,
        blocked: [{ from: first, to: second }],
        text: `${family(first)} can't reach ${family(second)}, ${family(second)} still reaches ${family(first)}`,
      };
    case 'netem': {
      const [, delay, jitter, loss] = fault.detail.match(/delay (\d+)ms (\d+)ms loss (\d+)%/);
      const node = nodesIn(fault.detail.split(' on ')[1])[0];
      return {
        ...none,
        slow: [node],
        text: `family ${family(node)} on a bad network: ${delay} ± ${jitter} ms, ${loss}% loss`,
      };
    }
    case 'member':
      return {
        ...none,
        out: [first],
        text: `family ${family(first)} removed, then back as a learner and promoted`,
      };
    case 'transfer':
      return {
        ...none,
        text: `the Don hands over from ${family(first)} to ${family(second)}`,
      };
    default:
      throw new Error(`no effect for a ${fault.kind} fault`);
  }
}

const lab = readdirSync(labDir)
  .filter((dir) => dir.includes('-3m'))
  .sort()
  .map((dir) => ({ dir, report: reportOf(dir) }));
const run = reportOf(replayed);
const leaders = run.leaders.map((entry) => ({
  at: seconds(entry.at_ns),
  node: entry.leader,
  term: entry.term,
}));
const leaderAt = (at) => leaders.filter((entry) => entry.at <= at).at(-1)?.node ?? 0;
const [hash, stateIndex] = run.hashes[0].split('@');

const data = {
  run: replayed,
  seconds: seconds(run.options.duration_ns),
  ops: run.ops,
  linearizable: run.linearizable === 'Ok',
  sameState: run.states_equal && new Set(run.hashes).size === 1,
  hash: hash.slice(0, 8),
  stateIndex: Number(stateIndex),
  leaders,
  faults: run.faults.map((fault) => ({
    start: seconds(fault.start_ns),
    end: seconds(fault.end_ns),
    kind: fault.kind,
    ...effects(fault, leaderAt(seconds(fault.start_ns))),
  })),
  lab: {
    runs: lab.length,
    faults: lab.reduce((total, { report }) => total + report.faults.length, 0),
    ops: lab.reduce((total, { report }) => total + report.ops, 0),
    linearizable: lab.filter(({ report }) => report.linearizable === 'Ok').length,
    sameState: lab.filter(({ report }) => report.states_equal).length,
  },
};

writeFileSync(outPath, `${JSON.stringify(data)}\n`);
console.log(
  `wrote ${outPath}: ${data.faults.length} faults and ${data.leaders.length} leader changes from ${replayed}; ${data.lab.runs} runs, ${data.lab.faults} faults, ${data.lab.ops} operations, ${data.lab.linearizable} linearizable`,
);
