import { describe, expect, it } from 'vitest';
import { createCommissionScene } from './commission';
import {
  commissionAt,
  commissionData,
  commissionLoop,
  commissionParameters,
} from './commission-model';
import type { SceneHooks } from './types';

const hooks = {
  renderer: undefined,
  label: () => document.createElement('span'),
  place: () => undefined,
  size: () => ({ width: 1200, height: 800 }),
} as unknown as SceneHooks;

const atRun = (seconds: number) => commissionAt(seconds / commissionParameters.speed);

describe("the lab run taken from FiveFamilies' results", () => {
  it('adds up to what its README says about the six three-minute runs', () => {
    expect(commissionData.lab).toEqual({
      runs: 6,
      faults: 187,
      ops: 287516,
      linearizable: 6,
      sameState: 6,
    });
  });

  it('replays a run with every kind of fault that ended linearizable at one state', () => {
    expect(commissionData).toMatchObject({
      seconds: 180,
      ops: 51012,
      linearizable: true,
      sameState: true,
    });
    expect(commissionData.faults).toHaveLength(32);
    expect(new Set(commissionData.faults.map((fault) => fault.kind)).size).toBe(10);
  });

  it('keeps faults and reigns in the order they happened', () => {
    const starts = commissionData.faults.map((fault) => fault.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    const terms = commissionData.leaders.map((entry) => entry.term).filter((term) => term > 0);
    expect(terms).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('the replay', () => {
  it('has no Don between killing the leader and the next election', () => {
    expect(atRun(31)).toMatchObject({ don: 2, term: 3 });
    expect(atRun(32.5)).toMatchObject({ don: 0 });
    expect(atRun(32.5).seat(2)).toBe('down');
    expect(atRun(34)).toMatchObject({ don: 1, term: 4 });
  });

  it('cuts a split both ways and a one-way fault in one direction', () => {
    const split = atRun(45);
    expect(split.fault?.text).toBe('split II | I III IV V');
    expect(split.blocked).toHaveLength(8);
    const oneWay = atRun(17);
    expect(oneWay.blocked).toEqual([{ from: 2, to: 3 }]);
  });

  it('ends the run with every family seated and eight reigns behind it', () => {
    const end = atRun(180);
    expect(end).toMatchObject({ finished: true, don: 3, term: 8, successions: 7, faults: 32 });
    expect([1, 2, 3, 4, 5].map((node) => end.seat(node))).toEqual(['up', 'up', 'up', 'up', 'up']);
  });
});

describe('the commission scene', () => {
  it('opens on the verdict, so a still frame already says it', () => {
    const scene = createCommissionScene(hooks);
    for (let i = 0; i < 40; i += 1) {
      scene.step(0.05, i * 0.05);
    }
    expect(scene.readout()).toEqual([
      'after the heal: 51,012 operations, linearizable',
      'all five families at state 178dddfd, entry 30,706',
      'the 6 three-minute runs: 187 faults · 287,516 operations · all linearizable',
    ]);
    scene.dispose();
  });

  it('starts the run again after the verdict', () => {
    const scene = createCommissionScene(hooks);
    for (let frame = 0; frame < 60 * (commissionParameters.holdSeconds + 3); frame += 1) {
      scene.step(1 / 60, frame / 60);
    }
    expect(scene.readout()[0]).toMatch(/^0:\d\d of 3:00 · reign 1, family I is the Don$/);
    expect(commissionLoop).toBeGreaterThan(30);
    scene.dispose();
  });
});
