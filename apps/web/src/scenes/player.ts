import type { SceneName } from '@portfolio/content';
import { Color, Vector3, WebGLRenderer } from 'three';
import type { LegendItem, Palette, SceneFactory, SceneInstance } from './types';

export type { SceneName };

const factories: Record<SceneName, () => Promise<SceneFactory>> = {
  systems: () => import('./systems').then((m) => m.createSystemsScene),
  floor: () => import('./floor').then((m) => m.createFloorScene),
  population: () => import('./population').then((m) => m.createPopulationScene),
};

export type PlayerOptions = {
  onReadout: (lines: string[]) => void;
  onLegend: (items: LegendItem[]) => void;
};

export type PlayerHandle = {
  setPlaying: (playing: boolean) => void;
  focus: (id: string | null) => void;
  dispose: () => void;
};

function readPalette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  const token = (name: string) => new Color(style.getPropertyValue(name).trim() || '#888888');
  return {
    bg: token('--bg'),
    fg: token('--fg'),
    muted: token('--muted'),
    line: token('--line'),
    grid: token('--grid'),
    accent: token('--accent'),
    signal: token('--signal'),
  };
}

export async function play(
  name: SceneName,
  canvas: HTMLCanvasElement,
  labels: HTMLElement,
  options: PlayerOptions,
): Promise<PlayerHandle> {
  const factory = await factories[name]();
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const projected = new Vector3();
  const host = canvas.parentElement ?? canvas;

  const instance: SceneInstance = factory({
    renderer,
    label(text, kind) {
      const element = document.createElement('div');
      element.className = `scene-label${kind ? ` scene-label-${kind}` : ''}`;
      element.textContent = text;
      labels.appendChild(element);
      return element;
    },
    place(element, x, y, z) {
      projected.set(x, y, z).project(instance.camera);
      const visible =
        projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15;
      element.style.display = visible ? '' : 'none';
      element.style.left = `${((projected.x + 1) / 2) * host.clientWidth}px`;
      element.style.top = `${((1 - projected.y) / 2) * host.clientHeight}px`;
    },
    size: () => ({ width: host.clientWidth, height: host.clientHeight }),
  });

  const applyColors = () => {
    const palette = readPalette(document.documentElement);
    renderer.setClearColor(palette.bg);
    instance.setColors(palette);
  };
  const resize = () => {
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    instance.camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
    instance.camera.updateProjectionMatrix();
  };
  applyColors();
  resize();
  options.onLegend(instance.legend ?? []);

  for (let i = 0; i < 40; i += 1) {
    instance.step(0.05, i * 0.05);
  }

  let playing = true;
  let visible = true;
  let clock = 0;
  let last = performance.now();
  let readoutAt = 0;
  let frame = 0;

  const draw = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible && !document.hidden) {
      if (playing) {
        clock += dt;
        instance.step(dt, clock);
      }
      instance.render(clock);
      renderer.render(instance.scene, instance.camera);
      if (now - readoutAt > 250) {
        readoutAt = now;
        options.onReadout(instance.readout());
      }
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
  });
  intersection.observe(host);
  const scheme = window.matchMedia('(prefers-color-scheme: dark)');
  scheme.addEventListener('change', applyColors);
  const themeObserver = new MutationObserver(applyColors);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class'],
  });

  return {
    setPlaying(next) {
      playing = next;
    },
    focus(id) {
      instance.focus?.(id);
    },
    dispose() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      scheme.removeEventListener('change', applyColors);
      themeObserver.disconnect();
      instance.dispose();
      renderer.dispose();
    },
  };
}
