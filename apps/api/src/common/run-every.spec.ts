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
});
