import { describe, expect, it } from 'vitest';
import { createStormScene, stormData, stormParameters, stormSample } from './storm';
import type { SceneHooks } from './types';

const hooks = {
  renderer: undefined,
  label: () => document.createElement('span'),
  place: () => undefined,
  size: () => ({ width: 1200, height: 800 }),
} as unknown as SceneHooks;

const box = stormData.policies.find((series) => series.id === 'box')!;
const pool = stormData.policies.find((series) => series.id === 'pool')!;

describe('the storm data taken from the poof simulator', () => {
  it('covers 25 simulated minutes around the burst, one sample a second', () => {
    expect(box.processes).toHaveLength(25 * 60);
    expect(pool.processes).toHaveLength(25 * 60);
    expect(stormData.startMinute).toBe(15);
    expect(stormData.burst).toMatchObject({ from: 20, to: 25 });
  });

  it('shows the box at the process limit and the pool inside its budget of two', () => {
    expect(Math.max(...box.processes)).toBeGreaterThanOrEqual(30);
    expect(Math.max(...box.processes)).toBeLessThanOrEqual(stormData.machine.processLimit);
    expect(Math.max(...pool.processes)).toBeLessThanOrEqual(2);
    expect(box.spawns.at(-1)).toBeGreaterThan(1000);
    expect(pool.spawns.at(-1)).toBe(0);
  });

  it('leaves the box behind after the burst while the pool drains its queue', () => {
    const afterBurst = (27 - stormData.startMinute) * 60;
    expect(stormSample(pool, afterBurst).queuedMinutes).toBe(0);
    expect(stormSample(box, afterBurst).queuedMinutes).toBeGreaterThan(10);
  });
});

describe('the storm scene', () => {
  it('reads out the sample it is showing and loops at the end', () => {
    const scene = createStormScene(hooks);
    const secondsToBurst = (stormData.burst.from - stormData.startMinute) * 60 + 30;
    const frames = Math.round((secondsToBurst / stormParameters.secondsPerSecond) * 60);
    for (let frame = 0; frame < frames; frame += 1) scene.step(1 / 60, frame / 60);
    const lines = scene.readout();
    expect(lines[0]).toContain('arrivals at 1.5× capacity');
    const now = stormSample(box, secondsToBurst);
    expect(lines[1]).toContain(`the box: ${now.processes} processes`);
    expect(lines[2]).toContain(
      `the pool: ${stormSample(pool, secondsToBurst).processes} processes`,
    );

    const rest =
      Math.round(((25 * 60 - secondsToBurst) / stormParameters.secondsPerSecond) * 60) + 60;
    for (let frame = 0; frame < rest; frame += 1) scene.step(1 / 60, frame / 60);
    expect(scene.readout()[0]).toContain(`simulated minute ${stormData.startMinute}`);
    scene.dispose();
  });
});
