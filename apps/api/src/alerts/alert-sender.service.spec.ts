import { describe, expect, it } from 'vitest';
import { retryDelaySeconds } from './alert-sender.service.js';

describe('retryDelaySeconds', () => {
  it('waits a minute after the first failure and doubles it each time, up to an hour', () => {
    expect([1, 2, 3, 6, 7, 20].map((attempts) => retryDelaySeconds(attempts, null))).toEqual([
      60, 120, 240, 1920, 3600, 3600,
    ]);
  });

  it('waits as long as Telegram asks when it says how long', () => {
    expect(retryDelaySeconds(5, 30)).toBe(30);
  });
});
