import type { Color, PerspectiveCamera, Scene } from 'three';

export type Palette = {
  bg: Color;
  fg: Color;
  muted: Color;
  line: Color;
  grid: Color;
  accent: Color;
  signal: Color;
};

export type SceneHooks = {
  palette: Palette;
  label: (text: string, kind?: 'signal' | 'node') => HTMLElement;
  write: (label: HTMLElement, text: string) => void;
  place: (label: HTMLElement, x: number, y: number, z: number) => void;
  size: () => { width: number; height: number };
  narrow: () => boolean;
};

export type SceneInstance = {
  scene: Scene;
  camera: PerspectiveCamera;
  step: (dt: number, time: number) => void;
  render: (time: number, dt?: number) => void;
  setColors: (palette: Palette) => void;
  readout: () => string[];
  focus?: (id: string | null) => void;
};

export type SceneFactory = (hooks: SceneHooks) => SceneInstance;
