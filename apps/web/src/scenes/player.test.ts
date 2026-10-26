import { describe, expect, it, vi } from 'vitest';
import { play } from './player';

const loadPopulation = vi.hoisted(() => vi.fn());

vi.mock('./population', async (importOriginal) => {
  loadPopulation();
  return importOriginal();
});

function start(name: 'floor' | 'population', signal: AbortSignal) {
  const canvas = document.createElement('canvas');
  const getContext = vi.spyOn(canvas, 'getContext');
  const starting = play({ name }, canvas, document.createElement('div'), {
    onReadout: () => undefined,
    signal,
    playing: true,
    shown: true,
  });
  return { starting, getContext };
}

describe('play', () => {
  it('stops a superseded scene before it fetches the scene or touches the canvas', async () => {
    const abort = new AbortController();
    abort.abort();
    const { starting, getContext } = start('population', abort.signal);
    await expect(starting).rejects.toMatchObject({ name: 'AbortError' });
    await vi.dynamicImportSettled();
    expect(loadPopulation).not.toHaveBeenCalled();
    expect(getContext).not.toHaveBeenCalled();
  });

  it('stops a scene that is superseded while its code is still loading', async () => {
    const abort = new AbortController();
    const { starting, getContext } = start('floor', abort.signal);
    abort.abort();
    await expect(starting).rejects.toMatchObject({ name: 'AbortError' });
    expect(getContext).not.toHaveBeenCalled();
  });
});
