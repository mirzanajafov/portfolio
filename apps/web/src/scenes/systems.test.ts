import { describe, expect, it } from 'vitest';
import { createSystemsScene } from './systems';
import { testHooks } from './test-hooks';

describe('the systems map', () => {
  it('runs without apps and sends no requests', () => {
    const scene = createSystemsScene(testHooks().hooks, []);
    const drawn = scene.scene.children.length;
    for (let i = 0; i < 40; i += 1) {
      scene.step(0.05, i * 0.05);
    }
    expect(scene.scene.children).toHaveLength(drawn);
    expect(scene.readout()).toEqual(['0 apps on one server']);
  });
});
