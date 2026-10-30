export type Device = 'phone' | 'tablet' | 'desktop';

export type Browser =
  'linkedin' | 'edge' | 'samsung' | 'opera' | 'firefox' | 'chrome' | 'safari' | 'other';

const browsers: [Browser, RegExp][] = [
  ['linkedin', /LinkedInApp/],
  ['edge', /Edg(?:A|iOS)?\//],
  ['samsung', /SamsungBrowser\//],
  ['opera', /OPR\/|OPiOS\//],
  ['firefox', /Firefox\/|FxiOS\//],
  ['chrome', /Chrome\/|CriOS\//],
  ['safari', /Safari\//],
];

export function browserOf(userAgent: string): Browser {
  return browsers.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? 'other';
}

export function deviceOf(userAgent: string): Device {
  const androidTablet = userAgent.includes('Android') && !userAgent.includes('Mobile');
  if (androidTablet || /iPad|Tablet/.test(userAgent)) {
    return 'tablet';
  }
  return /Mobi|iPhone|Android/.test(userAgent) ? 'phone' : 'desktop';
}
