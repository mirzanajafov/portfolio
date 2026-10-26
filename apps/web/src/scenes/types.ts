import type { Camera, Color, Scene } from 'three';

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
  label: (text: string, kind?: 'signal' | 'node') => HTMLElement;
  place: (element: HTMLElement, x: number, y: number, z: number) => void;
  size: () => { width: number; height: number };
};

export type SceneInstance = {
  scene: Scene;
  camera: Camera & { aspect: number; updateProjectionMatrix: () => void };
  step: (dt: number, time: number) => void;
  render: (time: number, dt?: number) => void;
  setColors: (palette: Palette) => void;
  readout: () => string[];
  focus?: (id: string | null) => void;
  dispose: () => void;
};

export type SceneFactory<TInput = void> = (hooks: SceneHooks, input: TInput) => SceneInstance;
