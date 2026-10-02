import type { Camera, Color, Scene, WebGLRenderer } from 'three';

export type Palette = {
  bg: Color;
  fg: Color;
  muted: Color;
  line: Color;
  grid: Color;
  accent: Color;
  signal: Color;
};

export type LegendItem = { id: string; label: string };

export type SceneHooks = {
  renderer: WebGLRenderer;
  label: (text: string, kind?: 'signal' | 'node') => HTMLElement;
  place: (element: HTMLElement, x: number, y: number, z: number) => void;
  size: () => { width: number; height: number };
};

export type SceneInstance = {
  scene: Scene;
  camera: Camera & { aspect: number; updateProjectionMatrix: () => void };
  step: (dt: number, time: number) => void;
  render: (time: number) => void;
  setColors: (palette: Palette) => void;
  readout: () => string[];
  legend?: LegendItem[];
  focus?: (id: string | null) => void;
  dispose: () => void;
};

export type SceneFactory = (hooks: SceneHooks) => SceneInstance;
