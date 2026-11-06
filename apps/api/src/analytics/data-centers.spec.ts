import { describe, expect, it } from 'vitest';
import { dataCenterOf } from './data-centers.js';

describe('dataCenterOf', () => {
  it.each([
    'Amazon.com, Inc.',
    'Google LLC',
    'Google Asia Pacific Pte. Ltd.',
    'Microsoft Corporation',
  ])('names %s, spelled as DB-IP spells it, as a data center', (network) => {
    expect(dataCenterOf({ network })).toBe(network);
  });

  it.each([
    ['Apple Private Relay through Akamai', 'Akamai Technologies, Inc.'],
    ['Apple Private Relay and WARP through Cloudflare', 'Cloudflare, Inc.'],
    ['a VPN host', 'M247 Europe SRL'],
    ['a carrier', 'Level 3 Communications, Inc.'],
    ['an internet provider', 'NetPoint LLC'],
    ["Google's home internet", 'Google Fiber Inc.'],
  ])('takes %s for people', (_, network) => {
    expect(dataCenterOf({ network })).toBeNull();
  });

  it('takes a visit with no known network for people', () => {
    expect(dataCenterOf({ network: null })).toBeNull();
  });
});
