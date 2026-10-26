import { assert, describe, expect, it } from 'vitest';
import { createFailoverScene, layoutIsWide, speedAt } from './failover';
import { failoverData, laneAt, stateOfA } from './failover-model';
import { testHooks } from './test-hooks';

const { hooks } = testHooks();

const probes = failoverData.lanes.find((lane) => lane.id === 'probes');
const all = failoverData.lanes.find((lane) => lane.id === 'all');
assert(probes && all, 'the failover data needs both lanes');
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const binsBetween = (values: number[], fromMs: number, toMs: number) =>
  values.slice(
    (fromMs - failoverData.fromMs) / failoverData.binMs,
    (toMs - failoverData.fromMs) / failoverData.binMs,
  );

describe("the failover data taken from PortalGun's crash run", () => {
  it('covers 3 s before to 42 s after the crash, one bin per 100 ms, at 2,000 requests a second', () => {
    expect(failoverData.fromMs).toBe(-3000);
    expect(failoverData.rate).toBe(2000);
    expect(Math.abs(failoverData.clearMs - 30000)).toBeLessThan(100);
    for (const lane of failoverData.lanes) {
      expect(lane.requests).toHaveLength(450);
      expect(sum(lane.requests) / 45).toBeGreaterThan(1900);
      expect(sum(lane.requests) / 45).toBeLessThan(2100);
    }
  });

  it("loses what PortalGun's README says: 1,560 with probes only, all in the first 1.5 s, and none with everything on", () => {
    expect(sum(probes.failed)).toBe(1560);
    expect(sum(binsBetween(probes.failed, 0, 1500))).toBe(1560);
    expect(sum(all.failed)).toBe(0);
  });

  it('sends about half the traffic to the dead dimension with probes only, and takes it out within milliseconds otherwise', () => {
    const down =
      sum(binsBetween(probes.failed, 0, 1500)) / sum(binsBetween(probes.requests, 0, 1500));
    expect(down).toBeGreaterThan(0.45);
    expect(down).toBeLessThan(0.6);
    const [unhealthy] = probes.events;
    const [ejected] = all.events;
    expect(unhealthy).toMatchObject({ state: 'unhealthy', reason: 'probes' });
    expect(unhealthy?.atMs).toBeGreaterThan(1400);
    expect(ejected?.state).toBe('ejected');
    expect(ejected?.atMs).toBeLessThan(10);
  });

  it('gives each of the three dimensions about a third before the crash', () => {
    for (const lane of failoverData.lanes) {
      const share =
        sum(binsBetween(lane.served, -3000, 0)) / sum(binsBetween(lane.requests, -3000, 0));
      expect(share).toBeGreaterThan(0.28);
      expect(share).toBeLessThan(0.4);
    }
  });
});

describe('the failover replay', () => {
  it('slows down around the crash and speeds through the quiet part', () => {
    expect(speedAt(-2000)).toBe(2);
    expect(speedAt(500)).toBe(0.25);
    expect(speedAt(15000)).toBe(6);
    expect(speedAt(35000)).toBe(2);
  });

  it('counts the lost requests and the share sent to a at any moment', () => {
    expect(laneAt(probes, -1000)).toMatchObject({ lost: 0 });
    expect(laneAt(probes, 500).toA).toBeGreaterThan(0.4);
    expect(laneAt(probes, 1600).lost).toBe(1560);
    expect(laneAt(probes, 1600).toA).toBe(0);
    expect(laneAt(all, 1600)).toMatchObject({ lost: 0, toA: 0 });
  });

  it("follows the state of a from the run's own health events", () => {
    expect(stateOfA(probes, -100)).toBe('up');
    expect(stateOfA(probes, 1000)).toBe('picked');
    expect(stateOfA(probes, 2000)).toBe('out');
    expect(stateOfA(probes, 30500)).toBe('out');
    expect(stateOfA(probes, 33000)).toBe('back');
    expect(stateOfA(all, 100)).toBe('out');
  });

  it('puts the two runs side by side on a wide canvas and one above the other on a tall one', () => {
    expect(layoutIsWide(2.4)).toBe(true);
    expect(layoutIsWide(0.7)).toBe(false);
  });
});

describe('the failover scene', () => {
  it('opens in the middle of the crash, so a still frame already shows it', () => {
    const scene = createFailoverScene(hooks);
    for (let i = 0; i < 40; i += 1) {
      scene.step(0.05, i * 0.05);
    }
    scene.render(2, 0.05);
    const [when, first, second] = scene.readout();
    expect(when).toContain('dimension a refuses every connection · slowed 4×');
    expect(first).toMatch(/^probes only: \d+% sent to a · [1-9][\d,]* lost$/);
    expect(second).toMatch(/^probes, ejection, retries: 0% sent to a · 0 lost/);
  });

  it('plays to the recovery and loops back to before the crash', () => {
    const scene = createFailoverScene(hooks);
    const seen: string[] = [];
    for (let frame = 0; frame < 60 * 30; frame += 1) {
      scene.step(1 / 60, frame / 60);
      if (frame % 30 === 0) {
        seen.push(...scene.readout().slice(0, 1));
      }
    }
    const back = seen.findIndex((line) => line.includes('a is back after 30 s'));
    expect(back).toBeGreaterThan(0);
    expect(seen.slice(back).some((line) => line.includes('three dimensions'))).toBe(true);
  });
});
