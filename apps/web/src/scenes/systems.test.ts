import { Color } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createSystemsScene } from './systems';
import type { SceneHooks } from './types';

const hooks: SceneHooks = {
  label: () => document.createElement('span'),
  place: () => undefined,
  size: () => ({ width: 1200, height: 800 }),
};

describe('the systems map', () => {
  it('runs without apps and sends no requests', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const scene = createSystemsScene(hooks, []);
    const color = new Color();
    scene.setColors({
      bg: color,
      fg: color,
      muted: color,
      line: color,
      grid: color,
      accent: color,
      signal: color,
    });
    for (let i = 0; i < 40; i += 1) {
      scene.step(0.05, i * 0.05);
    }
    expect(scene.readout()).toEqual(['0 apps on one server']);
    vi.unstubAllGlobals();
  });
});
