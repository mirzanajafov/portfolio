import { describe, expect, it } from 'vitest';
import { clientKey, networkOf } from './client-key.js';

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
