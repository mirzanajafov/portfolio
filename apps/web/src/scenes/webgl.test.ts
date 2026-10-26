import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('webglAvailable', () => {
  it('asks for WebGL2 once per page and gives the probe context back', async () => {
    const loseContext = vi.fn();
    const probe = { getExtension: () => ({ loseContext }) } as unknown as WebGL2RenderingContext;
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(probe);
    const { webglAvailable } = await import('./webgl');
    expect(webglAvailable()).toBe(true);
    expect(webglAvailable()).toBe(true);
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(getContext).toHaveBeenCalledWith('webgl2');
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('says no when the browser has no WebGL2', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { webglAvailable } = await import('./webgl');
    expect(webglAvailable()).toBe(false);
  });
});
