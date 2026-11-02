import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { siteUrl } from './site.ts';

const siteOriginOf = z.object({ environment: z.object({ SITE_ORIGIN: z.string() }) });

const composeSchema = z.object({
  services: z.object({
    api: siteOriginOf,
    web: siteOriginOf.extend({ ports: z.array(z.string()).optional() }),
  }),
});

function compose(file: string) {
  const text = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
  return composeSchema.parse(parse(text, { logLevel: 'error' })).services;
}

describe('the origin the API and the site check requests against', () => {
  it('is the public site in production, for both', () => {
    const { api, web } = compose('docker-compose.prod.yml');
    expect(api.environment.SITE_ORIGIN).toBe(new URL(siteUrl).origin);
    expect(web.environment.SITE_ORIGIN).toBe(new URL(siteUrl).origin);
  });

  it('is the port the local stack publishes the site on, for both', () => {
    const { api, web } = compose('docker-compose.yml');
    const published = web.ports?.[0]?.split(':')[0];
    expect(api.environment.SITE_ORIGIN).toBe(`http://localhost:${String(published)}`);
    expect(web.environment.SITE_ORIGIN).toBe(api.environment.SITE_ORIGIN);
  });
});
