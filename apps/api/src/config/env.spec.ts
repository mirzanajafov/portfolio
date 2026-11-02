import { describe, expect, it } from 'vitest';
import { parseEnv, trustProxySetting } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5442/db',
  CLIENT_HASH_SECRET: 'sixteen-chars-ok',
};

describe('parseEnv', () => {
  it('fills in defaults for everything optional', () => {
    const env = parseEnv(base);
    expect(env).toEqual(
      expect.objectContaining({
        PORT: 3201,
        TRUST_PROXY: 'loopback',
        ASK_PER_CLIENT_10_MIN: 20,
      }),
    );
  });

  it("takes the site's origin from SITE_ORIGIN, or the public site's when it is unset", () => {
    expect(parseEnv(base).SITE_ORIGIN).toBe('https://najafov.dev');
    expect(parseEnv({ ...base, SITE_ORIGIN: 'http://localhost:3200' }).SITE_ORIGIN).toBe(
      'http://localhost:3200',
    );
  });

  it.each(['localhost:3200', 'http://localhost:3200/', 'https://najafov.dev/privacy'])(
    'refuses %j as the site origin, because a browser never sends it as an Origin',
    (value) => {
      expect(() => parseEnv({ ...base, SITE_ORIGIN: value })).toThrow(/SITE_ORIGIN/);
    },
  );

  it('names every missing or broken variable at once, so a bad deploy fails on boot', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://x', ASK_PER_DAY: '-1' })).toThrow(
      /DATABASE_URL[\s\S]*CLIENT_HASH_SECRET[\s\S]*ASK_PER_DAY/,
    );
  });

  it('asks for a longer hash secret in production', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow(/CLIENT_HASH_SECRET/);
    expect(() =>
      parseEnv({ ...base, NODE_ENV: 'production', CLIENT_HASH_SECRET: 'x'.repeat(32) }),
    ).not.toThrow();
  });
});

describe('trustProxySetting', () => {
  it('turns a comma list into what Express expects', () => {
    expect(trustProxySetting('loopback, uniquelocal')).toEqual(['loopback', 'uniquelocal']);
    expect(trustProxySetting('false')).toBe(false);
  });
});
