import { Color } from 'three';
import { narrowWidth } from './player';
import type { Palette, SceneHooks } from './types';

const testPalette: Palette = {
  bg: new Color(),
  fg: new Color(),
  muted: new Color(),
  line: new Color(),
  grid: new Color(),
  accent: new Color(),
  signal: new Color(),
};

export function testHooks({ width = 1200 } = {}) {
  const labels: HTMLElement[] = [];
  const hooks: SceneHooks = {
    palette: testPalette,
    label(text) {
      const label = document.createElement('span');
      label.textContent = text;
      labels.push(label);
      return label;
    },
    write(label, text) {
      label.textContent = text;
    },
    place: () => undefined,
    size: () => ({ width, height: 800 }),
    narrow: () => width < narrowWidth,
  };
  return { hooks, labels };
}
