import { describe, expect, it } from 'vitest';
import { dailyKey, keyed } from './visitor-key.js';

describe('keyed', () => {
  const salt = new Uint8Array(32).fill(7);

  it('gives the same parts the same key under one salt', () => {
    expect(keyed(salt, '203.0.113.7', 'Chrome')).toBe(keyed(salt, '203.0.113.7', 'Chrome'));
  });

  it('gives another key under another salt, so yesterday cannot be matched with today', () => {
    expect(keyed(new Uint8Array(32).fill(8), '203.0.113.7', 'Chrome')).not.toBe(
      keyed(salt, '203.0.113.7', 'Chrome'),
    );
  });

  it('is 32 hex characters, never the address it was made from', () => {
    expect(keyed(salt, '203.0.113.7', 'Chrome')).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('dailyKey', () => {
  it('depends on the secret as well as the salt, so the database alone rebuilds nothing', () => {
    const salt = new Uint8Array(32).fill(7);
    expect(dailyKey('secret', salt)).toEqual(dailyKey('secret', salt));
    expect(dailyKey('other secret', salt)).not.toEqual(dailyKey('secret', salt));
    expect(dailyKey('secret', new Uint8Array(32).fill(8))).not.toEqual(dailyKey('secret', salt));
  });
});
