import campaignData from './campaign-data.json';

export { campaignData };

export type Run = (typeof campaignData.runs)[number];

const [first] = campaignData.runs;
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

const runCount = campaignData.runs.length;
const runsEnd = runCount / campaignPace.runsPerSecond;
export const mutantsEnd = runsEnd + campaignData.mutants.length * campaignPace.mutantSeconds;
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
  const shownMutants = countUpTo(seconds, mutantAppears, campaignData.mutants.length);
  const runsSoFar = campaignData.runs.slice(0, shownRuns);
  const mutantsSoFar = campaignData.mutants.slice(0, shownMutants);
  const total = (pick: (run: Run) => number) => runsSoFar.reduce((sum, run) => sum + pick(run), 0);
  return {
    shownRuns,
    shownMutants,
    run: runsSoFar.at(-1) ?? firstRun,
    mutant: mutantsSoFar.at(-1),
    journeys: total((run) => run.journeys),
    kills: total((run) => run.kills),
    crashes: total((run) => run.postgres + run.kafka),
    violations: total((run) => run.violations),
    caught: mutantsSoFar.filter((mutant) => mutant.caughtIn !== null).length,
  };
}
