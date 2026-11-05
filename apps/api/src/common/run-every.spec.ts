import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runEvery } from './run-every.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('runEvery', () => {
  it('keeps running after a failed run and says what failed', async () => {
    vi.useFakeTimers();
    const log = new Logger('test');
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => undefined);
    const task = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('the database is down'))
      .mockResolvedValue(undefined);
    const stop = runEvery(1000, 'cleanup', task, log);
    await vi.advanceTimersByTimeAsync(2000);
    expect(task).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith('cleanup failed: the database is down');
    stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('skips a tick while the last run is still going, so two runs never overlap', async () => {
    vi.useFakeTimers();
    const finishes: (() => void)[] = [];
    const task = vi.fn<() => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          finishes.push(resolve);
        }),
    );
    const stop = runEvery(1000, 'slow job', task, new Logger('test'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(task).toHaveBeenCalledTimes(1);
    finishes[0]?.();
    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });
});
