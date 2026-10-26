import { describe, expect, it, vi } from 'vitest';
import { play } from './player';

function start(signal: AbortSignal) {
  const canvas = document.createElement('canvas');
  const getContext = vi.spyOn(canvas, 'getContext');
  const playing = play({ name: 'floor' }, canvas, document.createElement('div'), {
    onReadout: () => undefined,
    signal,
    playing: true,
    shown: true,
  });
  return { playing, getContext };
}

describe('play', () => {
  it('stops a superseded scene before it touches the canvas', async () => {
    const abort = new AbortController();
    abort.abort();
    const { playing, getContext } = start(abort.signal);
    await expect(playing).rejects.toMatchObject({ name: 'AbortError' });
    expect(getContext).not.toHaveBeenCalled();
  });

  it('stops a scene that is superseded while its code is still loading', async () => {
    const abort = new AbortController();
    const { playing, getContext } = start(abort.signal);
    abort.abort();
    await expect(playing).rejects.toMatchObject({ name: 'AbortError' });
    expect(getContext).not.toHaveBeenCalled();
  });
});
