import { describe, expect, it } from 'vitest';
import { dailyKey, keyed, networkOf } from './visitor-key.js';

describe('networkOf', () => {
  it('keeps an IPv4 address whole', () => {
    expect(networkOf('203.0.113.7')).toBe('203.0.113.7');
  });

  it('reads an IPv4 address mapped into IPv6 as the IPv4 address', () => {
    expect(networkOf('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('cuts IPv6 to its /64, so a phone rotating privacy addresses stays one network', () => {
    expect(networkOf('2001:db8:85a3:12:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:85a3:12::/64');
    expect(networkOf('2001:db8:85a3:12::1')).toBe('2001:db8:85a3:12::/64');
  });

  it('reads compressed, padded and upper-case spellings of one prefix alike', () => {
    expect(networkOf('2001:0DB8::1')).toBe('2001:db8:0:0::/64');
    expect(networkOf('2001:db8:0:0:ffff::')).toBe('2001:db8:0:0::/64');
    expect(networkOf('::1')).toBe('0:0:0:0::/64');
  });

  it('keeps neighbouring /64 networks apart', () => {
    expect(networkOf('2001:db8:85a3:12::1')).not.toBe(networkOf('2001:db8:85a3:13::1'));
  });
});

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
