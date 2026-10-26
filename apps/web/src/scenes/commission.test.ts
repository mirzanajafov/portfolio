import { Color, LineBasicMaterial, LineSegments } from 'three';
import { describe, expect, it } from 'vitest';
import {
  commissionLoop,
  commissionParameters,
  commissionReplay,
  commissionRunEnd,
  createCommissionScene,
} from './commission';
import { type Fault, type Replay, commissionOf } from './commission-model';
import type { Palette, SceneHooks } from './types';

function sceneHooks(width: number) {
  const labels: HTMLElement[] = [];
  const hooks = {
    label: (text: string) => {
      const label = document.createElement('span');
      label.textContent = text;
      labels.push(label);
      return label;
    },
    place: () => undefined,
    size: () => ({ width, height: 800 }),
  } as unknown as SceneHooks;
  return { hooks, labels };
}

const palette: Palette = {
  bg: new Color(),
  fg: new Color(),
  muted: new Color(),
  line: new Color(),
  grid: new Color(),
  accent: new Color(),
  signal: new Color(),
};

const atRun = commissionOf(commissionReplay);

function replayWith(fault: Partial<Fault>): Replay {
  return {
    seconds: 60,
    leaders: [{ at: 0, node: 1, term: 1 }],
    faults: [{ start: 10, end: 20, kind: 'pause', nodes: [], groups: [], netem: null, ...fault }],
  };
}

describe("the lab run taken from FiveFamilies' results", () => {
  it('adds up to what its README says about the six three-minute runs', () => {
    expect(commissionReplay.lab).toEqual({
      runs: 6,
      faults: 187,
      ops: 287516,
      linearizable: 6,
    });
  });

  it('replays a run with every kind of fault', () => {
    expect(commissionReplay).toMatchObject({ seconds: 180, ops: 51012, hash: '178dddfd' });
    expect(commissionReplay.faults).toHaveLength(32);
    expect(new Set(commissionReplay.faults.map((fault) => fault.kind)).size).toBe(10);
  });

  it('keeps faults and reigns in the order they happened', () => {
    const starts = commissionReplay.faults.map((fault) => fault.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    const terms = commissionReplay.leaders.map((entry) => entry.term).filter((term) => term > 0);
    expect(terms).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('the replay', () => {
  it('has no Don from the moment the leader is killed until the next one is seen', () => {
    expect(atRun(31)).toMatchObject({ don: 2, term: 3 });
    expect(atRun(31.9)).toMatchObject({ don: 0 });
    expect(atRun(31.9).seat(2)).toBe('down');
    expect(atRun(34)).toMatchObject({ don: 1, term: 4 });
  });

  it('cuts a split both ways and a one-way fault in one direction', () => {
    const split = atRun(45);
    expect(split.fault?.text).toBe('split II | I III IV V');
    expect(split.link(1, 2)).toBe('cut');
    expect(split.link(1, 3)).toBe('open');
    const oneWay = atRun(17);
    expect(oneWay.fault?.text).toBe("family II's packets to III dropped");
    expect(oneWay.link(2, 3)).toBe('one-way');
  });

  it('loses the heartbeat to a family that is down or cut off, and only one that is up answers', () => {
    const split = atRun(45);
    expect(split.speaker).toBe(1);
    expect(split.heartbeat(2)).toBe('lost');
    expect(split.heartbeat(3)).toBe('answered');
    const frozen = atRun(4);
    expect(frozen.seat(4)).toBe('frozen');
    expect(frozen.heartbeat(4)).toBe('unanswered');
    const killed = atRun(25);
    expect(killed.speaker).toBe(5);
    expect(killed.heartbeat(1)).toBe('lost');
    expect(killed.heartbeat(5)).toBe('none');
  });

  it('names the leader a kill hits, and the family a bridge leaves in the middle', () => {
    expect(atRun(32).fault?.text).toBe('SIGKILL family II, the Don');
    expect(atRun(23).fault?.text).toBe('SIGKILL family I');
    expect(atRun(100).fault?.text).toBe('I II III | V, bridged by IV');
  });

  it('ends the run with every family seated and eight reigns behind it', () => {
    const end = atRun(180);
    expect(end).toMatchObject({ finished: true, don: 3, term: 8, successions: 7, faultsSoFar: 32 });
    expect([1, 2, 3, 4, 5].map((node) => end.seat(node))).toEqual(['up', 'up', 'up', 'up', 'up']);
  });

  it('does not crown a killed leader again when it restarts before a new one is seen', () => {
    const restarted = commissionOf({
      ...replayWith({ kind: 'kill-leader', nodes: [1], start: 10, end: 12 }),
      leaders: [
        { at: 0, node: 1, term: 1 },
        { at: 14, node: 2, term: 2 },
      ],
    });
    expect(restarted(11)).toMatchObject({ don: 0 });
    expect(restarted(13)).toMatchObject({ don: 0, speaker: 0 });
    expect(restarted(15)).toMatchObject({ don: 2, term: 2 });
  });

  it('keeps a frozen Don as the Don, though nobody hears from it', () => {
    const frozen = commissionOf(replayWith({ kind: 'pause', nodes: [1] }))(15);
    expect(frozen).toMatchObject({ don: 1, speaker: 0 });
    expect(frozen.heartbeat(2)).toBe('none');
  });

  it('takes a removed family off the table, its links and its heartbeats', () => {
    const removed = commissionOf(replayWith({ kind: 'member', nodes: [3] }))(15);
    expect(removed.seat(3)).toBe('out');
    expect(removed.link(1, 3)).toBe('cut');
    expect(removed.heartbeat(3)).toBe('none');
  });

  it('marks the links of a family on a bad network and says how bad', () => {
    const slow = commissionOf(
      replayWith({ kind: 'netem', nodes: [2], netem: { delay: 45, jitter: 18, loss: 9 } }),
    )(15);
    expect(slow.link(1, 2)).toBe('slow');
    expect(slow.link(1, 3)).toBe('open');
    expect(slow.fault?.text).toBe('family II on a bad network: 45 ± 18 ms, 9% loss');
  });
});

describe('the commission scene', () => {
  it('opens on the verdict, so a still frame already says it', () => {
    const { hooks, labels } = sceneHooks(1200);
    const scene = createCommissionScene(hooks);
    scene.setColors(palette);
    for (let i = 0; i < 40; i += 1) {
      scene.step(0.05, i * 0.05);
    }
    scene.render(2, 10);
    expect(scene.readout()).toEqual([
      'after the heal: 51,012 operations, linearizable',
      'all five families at state 178dddfd, entry 30,706',
      '6 three-minute runs: 187 faults · 287,516 operations · 6 of 6 linearizable',
    ]);
    expect(labels.map((label) => label.textContent)).toContain('III · 178dddfd');
    scene.dispose();
  });

  it('leaves the state hash off the families at the verdict on a narrow screen', () => {
    const { hooks, labels } = sceneHooks(400);
    const scene = createCommissionScene(hooks);
    scene.setColors(palette);
    scene.step(2, 2);
    scene.render(2, 10);
    expect(labels.map((label) => label.textContent)).toContain('III');
    scene.dispose();
  });

  it('draws no line across a link a fault cuts', () => {
    const { hooks } = sceneHooks(1200);
    const scene = createCommissionScene(hooks);
    scene.setColors(palette);
    const openedAt = commissionRunEnd - 1;
    scene.step(commissionLoop - openedAt + 52 / commissionParameters.speed, 0);
    scene.render(0, 10);
    const [links] = scene.scene.children.filter(
      (child): child is LineSegments =>
        child instanceof LineSegments &&
        child.material instanceof LineBasicMaterial &&
        child.material.vertexColors,
    );
    const positions = links?.geometry.getAttribute('position');
    const lengths = Array.from({ length: (positions?.count ?? 0) / 2 }, (_, index) =>
      Math.hypot(
        (positions?.getX(index * 2) ?? 0) - (positions?.getX(index * 2 + 1) ?? 0),
        (positions?.getZ(index * 2) ?? 0) - (positions?.getZ(index * 2 + 1) ?? 0),
      ),
    );
    expect(scene.readout()[1]).toBe('family II cut off from the rest');
    expect(lengths.map((length) => length > 0)).toEqual([
      false,
      true,
      true,
      true,
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
    scene.dispose();
  });

  it('starts the run again after the verdict and counts successions in words', () => {
    const { hooks, labels } = sceneHooks(1200);
    const scene = createCommissionScene(hooks);
    scene.setColors(palette);
    for (let frame = 0; frame < 60 * 9; frame += 1) {
      scene.step(1 / 60, frame / 60);
    }
    scene.render(9, 1 / 60);
    const [first, , third] = scene.readout();
    expect(first).toMatch(/^0:2\d of 3:00 · reign 2, family V is the Don$/);
    expect(third).toMatch(/^fault 5 of 32 · 1 succession so far$/);
    expect(labels.map((label) => label.textContent)).toContain('V · Don');
    scene.dispose();
  });
});
