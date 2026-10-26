import data from './campaign-data.json';

export const campaignData = data;

export type Run = (typeof data.runs)[number];

const [first] = data.runs;
if (!first) {
  throw new Error('the campaign data has no runs');
}
export const firstRun: Run = first;

export const campaignPace = {
  runsPerSecond: 10,
  mutantSeconds: 0.6,
  holdSeconds: 3.5,
  clearSeconds: 0.8,
};

const runCount = data.runs.length;
const runsEnd = runCount / campaignPace.runsPerSecond;
export const mutantsEnd = runsEnd + data.mutants.length * campaignPace.mutantSeconds;
export const holdEnd = mutantsEnd + campaignPace.holdSeconds;
export const campaignLoop = holdEnd + campaignPace.clearSeconds;

export const runAppears = (index: number) => index / campaignPace.runsPerSecond;
export const mutantAppears = (index: number) => runsEnd + index * campaignPace.mutantSeconds;

function countUpTo(seconds: number, appears: (index: number) => number, total: number): number {
  let count = 0;
  while (count < total && appears(count) <= seconds + 1e-9) {
    count += 1;
  }
  return count;
}

export function campaignAt(seconds: number) {
  const shownRuns = countUpTo(seconds, runAppears, runCount);
  const shownMutants = countUpTo(seconds, mutantAppears, data.mutants.length);
  const shown = data.runs.slice(0, shownRuns);
  const total = (pick: (run: Run) => number) => shown.reduce((sum, run) => sum + pick(run), 0);
  return {
    shownRuns,
    shownMutants,
    run: shown.at(-1) ?? firstRun,
    mutant: data.mutants[shownMutants - 1],
    journeys: total((run) => run.journeys),
    kills: total((run) => run.kills),
    crashes: total((run) => run.postgres + run.kafka),
    violations: total((run) => run.violations),
    caught: data.mutants.slice(0, shownMutants).filter((mutant) => mutant.caughtIn !== null).length,
  };
}
