export const devices = ['phone', 'tablet', 'desktop'] as const;

export type Device = (typeof devices)[number];

export const browsers = [
  'linkedin',
  'edge',
  'samsung',
  'opera',
  'firefox',
  'chrome',
  'safari',
  'other',
] as const;

export type Browser = (typeof browsers)[number];

const browserPatterns: [Browser, RegExp][] = [
  ['linkedin', /LinkedInApp/],
  ['edge', /Edg(?:A|iOS)?\//],
  ['samsung', /SamsungBrowser\//],
  ['opera', /OPR\/|OPiOS\//],
  ['firefox', /Firefox\/|FxiOS\//],
  ['chrome', /Chrome\/|CriOS\//],
  ['safari', /Safari\//],
];

export function browserOf(userAgent: string): Browser {
  return browserPatterns.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? 'other';
}

export function deviceOf(userAgent: string): Device {
  const androidTablet = userAgent.includes('Android') && !userAgent.includes('Mobile');
  if (androidTablet || /iPad|Tablet/.test(userAgent)) {
    return 'tablet';
  }
  return /Mobi|iPhone|Android/.test(userAgent) ? 'phone' : 'desktop';
}
