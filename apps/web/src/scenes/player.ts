import type { DemoName } from '@portfolio/content';
import { Color, Vector3, WebGLRenderer } from 'three';
import { disposeScene } from './dispose';
import { labelPosition } from './label-position';
import type { GraphApp } from './systems-graph';
import type { Palette, SceneFactory, SceneInstance } from './types';

export type SceneSpec = { name: 'systems'; apps: GraphApp[] } | { name: DemoName };

const demos: Record<DemoName, () => Promise<SceneFactory>> = {
  floor: () => import('./floor').then((m) => m.createFloorScene),
  population: () => import('./population').then((m) => m.createPopulationScene),
  storm: () => import('./storm').then((m) => m.createStormScene),
  failover: () => import('./failover').then((m) => m.createFailoverScene),
  campaign: () => import('./campaign').then((m) => m.createCampaignScene),
  commission: () => import('./commission').then((m) => m.createCommissionScene),
};

export const narrowWidth = 600;

async function load(spec: SceneSpec): Promise<SceneFactory> {
  if (spec.name === 'systems') {
    const { createSystemsScene } = await import('./systems');
    return (hooks) => createSystemsScene(hooks, spec.apps);
  }
  return demos[spec.name]();
}

export type PlayerHandle = {
  setPlaying: (playing: boolean) => void;
  setShown: (shown: boolean) => void;
  focus: (id: string | null) => void;
  dispose: () => void;
};

function readPalette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  const token = (name: string) => {
    const value = style.getPropertyValue(name).trim();
    if (!value) {
      throw new Error(`the page defines no ${name} color for the scenes`);
    }
    return new Color(value);
  };
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

type PlayOptions = {
  onReadout: (lines: string[]) => void;
  signal: AbortSignal;
  playing: boolean;
  shown: boolean;
};

function mount(
  create: SceneFactory,
  canvas: HTMLCanvasElement,
  labels: HTMLElement,
  options: PlayOptions,
): PlayerHandle {
  const host = canvas.parentElement ?? canvas;
  const projected = new Vector3();
  const halfWidths = new WeakMap<HTMLElement, { text: string | null; half: number }>();
  const halfWidth = (label: HTMLElement) => {
    const known = halfWidths.get(label);
    if (known?.text === label.textContent) {
      return known.half;
    }
    const half = label.offsetWidth / 2;
    if (half > 0) {
      halfWidths.set(label, { text: label.textContent, half });
    }
    return half;
  };

  const palette = readPalette(document.documentElement);
  const instance: SceneInstance = create({
    palette,
    label(text, kind) {
      const element = document.createElement('div');
      element.className = `scene-label${kind ? ` scene-label-${kind}` : ''}`;
      element.textContent = text;
      labels.appendChild(element);
      return element;
    },
    write(label, text) {
      if (label.textContent !== text) {
        label.textContent = text;
      }
    },
    place(label, x, y, z) {
      projected.set(x, y, z).project(instance.camera);
      const spot = labelPosition(projected, host.clientWidth, host.clientHeight, halfWidth(label));
      label.style.display = spot ? '' : 'none';
      if (spot) {
        label.style.left = `${spot.left}px`;
        label.style.top = `${spot.top}px`;
      }
    },
    size: () => ({ width: host.clientWidth, height: host.clientHeight }),
    narrow: () => host.clientWidth < narrowWidth,
  });
  const fitCamera = () => {
    instance.camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
    instance.camera.updateProjectionMatrix();
  };
  instance.setColors(palette);
  fitCamera();
  for (let i = 0; i < 40; i += 1) {
    instance.step(0.05, i * 0.05);
  }

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(palette.bg);
  const resize = () => {
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    fitCamera();
  };
  resize();
  const applyColors = () => {
    const next = readPalette(document.documentElement);
    renderer.setClearColor(next.bg);
    instance.setColors(next);
  };

  let { playing, shown } = options;
  let visible = true;
  let clock = 0;
  let last = performance.now();
  let readoutAt = 0;
  let frame = 0;

  const draw = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible && shown && !document.hidden) {
      if (playing) {
        clock += dt;
        instance.step(dt, clock);
      }
      instance.render(clock, playing ? dt : 10);
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
    setShown(next) {
      shown = next;
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
      disposeScene(instance.scene);
      renderer.dispose();
      labels.replaceChildren();
    },
  };
}

export async function play(
  spec: SceneSpec,
  canvas: HTMLCanvasElement,
  labels: HTMLElement,
  options: PlayOptions,
): Promise<PlayerHandle> {
  options.signal.throwIfAborted();
  const create = await load(spec);
  options.signal.throwIfAborted();
  try {
    return mount(create, canvas, labels, options);
  } catch (error) {
    labels.replaceChildren();
    throw error;
  }
}
