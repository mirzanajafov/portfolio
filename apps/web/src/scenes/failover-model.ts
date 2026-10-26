import { MathUtils } from 'three';
import failoverData from './failover-data.json';
import { commonLength, sampleAt } from './series';

export { failoverData };

type FailoverLane = (typeof failoverData.lanes)[number];

const bins = commonLength(
  failoverData.lanes.flatMap((lane) => [lane.requests, lane.served, lane.failed, lane.retried]),
);

export const failoverEnd = failoverData.fromMs + bins * failoverData.binMs;

function binAt(ms: number): number {
  return MathUtils.clamp(Math.floor((ms - failoverData.fromMs) / failoverData.binMs), 0, bins - 1);
}

export function laneAt(lane: FailoverLane, ms: number) {
  const position = MathUtils.clamp((ms - failoverData.fromMs) / failoverData.binMs, 0, bins);
  const whole = Math.floor(position);
  let lost = 0;
  let retried = 0;
  for (let i = 0; i < whole; i += 1) {
    lost += sampleAt(lane.failed, i);
    retried += sampleAt(lane.retried, i);
  }
  const bin = binAt(ms);
  const part = position - whole;
  if (part > 0) {
    lost += sampleAt(lane.failed, bin) * part;
    retried += sampleAt(lane.retried, bin) * part;
  }
  const requests = Math.max(1, sampleAt(lane.requests, bin));
  const sentToA =
    sampleAt(lane.served, bin) + sampleAt(lane.failed, bin) + sampleAt(lane.retried, bin);
  return {
    lost: Math.floor(lost),
    retried: Math.floor(retried),
    toA: sentToA / requests,
  };
}

export function faultAt(ms: number): 'before' | 'down' | 'cleared' {
  if (ms < 0) {
    return 'before';
  }
  return ms < failoverData.clearMs ? 'down' : 'cleared';
}

export function stateOfA(lane: FailoverLane, ms: number): 'up' | 'picked' | 'out' | 'back' {
  const fault = faultAt(ms);
  if (fault === 'before') {
    return 'up';
  }
  const last = lane.events.filter((e) => e.atMs <= ms).at(-1);
  if (last !== undefined && (last.state === 'ejected' || last.state === 'unhealthy')) {
    return 'out';
  }
  return fault === 'down' ? 'picked' : 'back';
}

export const fates = ['served', 'failed', 'retried', 'other'] as const;

export type Fate = (typeof fates)[number];

export function countsBetween(lane: FailoverLane, from: number, to: number): Record<Fate, number> {
  const counts = { served: 0, failed: 0, retried: 0, other: 0 };
  for (let bin = binAt(from); bin <= binAt(to - 1e-6); bin += 1) {
    const start = failoverData.fromMs + bin * failoverData.binMs;
    const overlap = Math.max(0, Math.min(to, start + failoverData.binMs) - Math.max(from, start));
    const share = overlap / failoverData.binMs;
    const served = sampleAt(lane.served, bin);
    const failed = sampleAt(lane.failed, bin);
    const retried = sampleAt(lane.retried, bin);
    counts.served += served * share;
    counts.failed += failed * share;
    counts.retried += retried * share;
    counts.other += Math.max(0, sampleAt(lane.requests, bin) - served - failed - retried) * share;
  }
  return counts;
}
