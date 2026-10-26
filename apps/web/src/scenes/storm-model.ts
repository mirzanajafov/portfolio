import data from './storm-data.json';
import { commonLength, sampleAt } from './series';

export const stormData = data;

export type StormSeries = (typeof data.policies)[number];

const box = data.policies.find((series) => series.id === 'box');
const pool = data.policies.find((series) => series.id === 'pool');
if (data.policies.length !== 2 || !box || !pool) {
  throw new Error('the storm data needs the box and the pool');
}
const samplesOf = (series: StormSeries) => [
  series.processes,
  series.running,
  series.goodput,
  series.spawns,
  series.backlogSeconds,
];

export const stormSeries = { box, pool };
export const stormSeconds = commonLength([...samplesOf(box), ...samplesOf(pool)]);

const processCounts = [...box.processes, ...pool.processes];
if (processCounts.some((count) => !Number.isInteger(count) || count > data.machine.processLimit)) {
  throw new Error('the storm data needs whole process counts that fit in the machine');
}

export function stormSample(series: StormSeries, second: number) {
  return {
    processes: sampleAt(series.processes, second),
    running: sampleAt(series.running, second),
    goodput: sampleAt(series.goodput, second),
    spawns: sampleAt(series.spawns, second),
    queuedMinutes: sampleAt(series.backlogSeconds, second) / 60,
  };
}

export function burstAt(second: number): boolean {
  const minute = data.startMinute + second / 60;
  return minute >= data.burst.from && minute < data.burst.to;
}

export function stormAt(second: number) {
  const burst = burstAt(second);
  return {
    minute: Math.floor(data.startMinute + second / 60),
    burst,
    load: burst ? data.burst.load : data.baseLoad,
    box: stormSample(stormSeries.box, second),
    pool: stormSample(stormSeries.pool, second),
  };
}
