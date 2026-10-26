import { describe, expect, it, vi } from 'vitest';
import { play } from './player';

function start(signal: AbortSignal) {
  const canvas = document.createElement('canvas');
  const getContext = vi.spyOn(canvas, 'getContext');
  const started = play({ name: 'floor' }, canvas, document.createElement('div'), {
    onReadout: () => undefined,
    signal,
    playing: true,
    shown: true,
  });
  return { started, getContext };
}

describe('play', () => {
  it('stops a superseded scene before it touches the canvas', async () => {
    const abort = new AbortController();
    abort.abort();
    const { started, getContext } = start(abort.signal);
    await expect(started).rejects.toMatchObject({ name: 'AbortError' });
    expect(getContext).not.toHaveBeenCalled();
  });

  it('stops a scene that is superseded while its code is still loading', async () => {
    const abort = new AbortController();
    const { started, getContext } = start(abort.signal);
    abort.abort();
    await expect(started).rejects.toMatchObject({ name: 'AbortError' });
    expect(getContext).not.toHaveBeenCalled();
  });
});
