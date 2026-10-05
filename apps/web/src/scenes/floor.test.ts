import { describe, expect, it } from 'vitest';
import type { SceneHooks } from './types';
import { createFloorScene } from './floor';

const hooks = {
  renderer: undefined,
  label: () => document.createElement('span'),
  place: () => undefined,
  size: () => ({ width: 1200, height: 800 }),
} as unknown as SceneHooks;

describe('the floor scene', () => {
  it('runs the estimator Marauder runs, and lands in the error range the benchmark measured', () => {
    const scene = createFloorScene(hooks);
    const errors: number[] = [];
    for (let frame = 0; frame < 60 * 120; frame += 1) {
      scene.step(1 / 60, frame / 60);
      if (frame > 60 * 10 && frame % 30 === 0) {
        const line = scene.readout().find((text) => text.startsWith('estimate error'));
        errors.push(Number(line?.match(/([\d.]+) m/)?.[1]));
      }
    }
    errors.sort((a, b) => a - b);
    const median = errors[Math.floor(errors.length / 2)]!;
    expect(errors.length).toBeGreaterThan(200);
    expect(median).toBeGreaterThan(0.3);
    expect(median).toBeLessThan(2.5);
    expect(scene.readout().join(' ')).toContain('log-distance fit');
    scene.dispose();
  });
});
