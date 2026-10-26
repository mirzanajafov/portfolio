import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { play } from './player';
import type { SceneHooks } from './types';

const renderers = vi.hoisted(() => ({ fail: false, created: 0, disposed: 0 }));
const loadPopulation = vi.hoisted(() => vi.fn());

vi.mock('three', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  WebGLRenderer: class {
    constructor() {
      if (renderers.fail) {
        throw new Error('Error creating WebGL context.');
      }
      renderers.created += 1;
    }
    setPixelRatio = () => undefined;
    setClearColor = () => undefined;
    setSize = () => undefined;
    render = () => undefined;
    dispose = () => {
      renderers.disposed += 1;
    };
  },
}));

vi.mock('./population', async (importOriginal) => {
  loadPopulation();
  return importOriginal();
});

vi.mock('./storm', () => ({
  createStormScene: (hooks: SceneHooks) => {
    hooks.label('half built');
    throw new RangeError('every series needs the same, non-zero number of samples');
  },
}));

class InertObserver {
  observe = () => undefined;
  disconnect = () => undefined;
}

beforeEach(() => {
  Object.assign(renderers, { fail: false, created: 0, disposed: 0 });
  vi.stubGlobal('ResizeObserver', InertObserver);
  vi.stubGlobal('IntersectionObserver', InertObserver);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function start(name: 'floor' | 'population' | 'storm', signal = new AbortController().signal) {
  const labels = document.createElement('div');
  const starting = play({ name }, document.createElement('canvas'), labels, {
    onReadout: () => undefined,
    signal,
    playing: true,
    shown: true,
  });
  return { starting, labels };
}

describe('play', () => {
  it('stops a superseded scene before it fetches the scene or builds a renderer', async () => {
    const abort = new AbortController();
    abort.abort();
    const { starting } = start('population', abort.signal);
    await expect(starting).rejects.toMatchObject({ name: 'AbortError' });
    await vi.dynamicImportSettled();
    expect(loadPopulation).not.toHaveBeenCalled();
    expect(renderers.created).toBe(0);
  });

  it('stops a scene that is superseded while its code is still loading', async () => {
    const abort = new AbortController();
    const { starting } = start('floor', abort.signal);
    abort.abort();
    await expect(starting).rejects.toMatchObject({ name: 'AbortError' });
    expect(renderers.created).toBe(0);
  });

  it('builds the scene before the renderer, so a scene that fails leaves no renderer or labels', async () => {
    const { starting, labels } = start('storm');
    await expect(starting).rejects.toThrow(RangeError);
    expect(renderers.created).toBe(0);
    expect(labels.childElementCount).toBe(0);
  });

  it('removes the labels of a scene whose renderer cannot start', async () => {
    renderers.fail = true;
    const { starting, labels } = start('floor');
    await expect(starting).rejects.toThrow('Error creating WebGL context.');
    expect(labels.childElementCount).toBe(0);
  });

  it('removes its labels and frees the renderer when it is disposed', async () => {
    const { starting, labels } = start('floor');
    const handle = await starting;
    expect(labels.childElementCount).toBeGreaterThan(0);
    handle.dispose();
    expect(labels.childElementCount).toBe(0);
    expect(renderers.disposed).toBe(1);
  });
});
