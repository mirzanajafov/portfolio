import { describe, expect, it } from 'vitest';
import { clientKey } from './client-key.js';

const noon = new Date('2026-10-02T12:00:00Z');

describe('clientKey', () => {
  it('gives the same caller the same key all day, so rate limits work', () => {
    expect(clientKey('203.0.113.7', 'secret', noon)).toBe(
      clientKey('203.0.113.7', 'secret', new Date('2026-10-02T23:59:59Z')),
    );
  });

  it('changes the next day, so stored keys cannot follow a visitor over time', () => {
    expect(clientKey('203.0.113.7', 'secret', noon)).not.toBe(
      clientKey('203.0.113.7', 'secret', new Date('2026-10-03T00:00:01Z')),
    );
  });

  it('never contains the address and depends on the secret', () => {
    const key = clientKey('203.0.113.7', 'secret', noon);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain('203');
    expect(clientKey('203.0.113.7', 'other', noon)).not.toBe(key);
  });
});
