import { aProject, contentOf } from '@portfolio/content/testing';
import { describe, expect, it } from 'vitest';
import { eventSchema, linksIn } from './event.schema.js';

const schema = eventSchema(new Set(['/cv.pdf']));
const view = '0193f1a2-7c4e-7b2a-9d1e-5f6a7b8c9d0e';

const aView = (overrides: Record<string, unknown> = {}) => ({
  type: 'view',
  id: view,
  path: '/',
  ...overrides,
});

const aRead = (overrides: Record<string, unknown> = {}) => ({
  type: 'read',
  view,
  seq: 1,
  activeSeconds: 12,
  maxScroll: 40,
  blocks: { problem: 4 },
  ...overrides,
});

describe('eventSchema', () => {
  it('accepts a page view and marks it as found unless told otherwise', () => {
    expect(schema.parse(aView({ referrer: 'WWW.LinkedIn.com', ref: 'memh' }))).toEqual({
      type: 'view',
      id: view,
      path: '/',
      referrer: 'www.linkedin.com',
      ref: 'memh',
      notFound: false,
    });
  });

  it('keeps a page view whose code is malformed, without the code', () => {
    expect(schema.parse(aView({ ref: 'Acme Careers' }))).toEqual({
      type: 'view',
      id: view,
      path: '/',
      notFound: false,
    });
  });

  it('keeps unknown paths, because 404s are worth seeing, but only paths', () => {
    for (const path of ['/projects/no-such-thing', '/foo%20bar', '/@someone', '/a:b+c']) {
      expect(schema.safeParse(aView({ path })).success).toBe(true);
    }
    expect(schema.safeParse(aView({ path: 'https://elsewhere.example/' })).success).toBe(false);
    expect(schema.safeParse(aView({ path: '/?r=memh' })).success).toBe(false);
    expect(schema.safeParse(aView({ path: `/${'a'.repeat(201)}` })).success).toBe(false);
  });

  it('keeps a page view whose referrer is not a host, without the referrer', () => {
    for (const referrer of ['https://www.google.com/search?q=x', '[2001:db8::1]', 'example.com.']) {
      expect(schema.parse(aView({ referrer }))).toEqual({
        type: 'view',
        id: view,
        path: '/',
        notFound: false,
      });
    }
  });

  it('refuses fields it does not know', () => {
    expect(schema.safeParse(aView({ screen: '390x844' })).success).toBe(false);
  });

  it('caps a reading at 30 blocks with short lowercase names', () => {
    const blocks = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`block-${i}`, 1]));
    expect(schema.safeParse(aRead({ blocks })).success).toBe(false);
    expect(schema.safeParse(aRead({ blocks: { Problem: 1 } })).success).toBe(false);
  });

  it('numbers readings from 1', () => {
    expect(schema.safeParse(aRead({ seq: 1 })).success).toBe(true);
    expect(schema.safeParse(aRead({ seq: 0 })).success).toBe(false);
  });

  it('only takes clicks on links the site shows', () => {
    expect(schema.safeParse({ type: 'click', view, href: '/cv.pdf' }).success).toBe(true);
    expect(
      schema.safeParse({ type: 'click', view, href: 'https://elsewhere.example' }).success,
    ).toBe(false);
  });

  it('takes Web Vitals in their own ranges', () => {
    expect(schema.safeParse({ type: 'vital', view, name: 'LCP', value: 4200 }).success).toBe(true);
    expect(schema.safeParse({ type: 'vital', view, name: 'CLS', value: 0.12 }).success).toBe(true);
    expect(schema.safeParse({ type: 'vital', view, name: 'CLS', value: 12 }).success).toBe(false);
    expect(schema.safeParse({ type: 'vital', view, name: 'FID', value: 12 }).success).toBe(false);
  });

  it('takes an error with its place, but not a long message or a line past 32 bits', () => {
    const error = { type: 'error', view, message: 'x is undefined', source: '/_next/static/a.js' };
    expect(schema.safeParse({ ...error, line: 3, column: 14 }).success).toBe(true);
    expect(schema.safeParse({ ...error, source: 'external' }).success).toBe(true);
    expect(schema.safeParse({ ...error, message: 'x'.repeat(201) }).success).toBe(false);
    expect(schema.safeParse({ ...error, line: 3_000_000_000 }).success).toBe(false);
  });

  it('takes the source of an error as a path on this site, or only the word external', () => {
    const error = { type: 'error', view, message: 'x is undefined' };
    for (const source of [
      'https://najafov.dev/_next/static/a.js?r=memh',
      'chrome-extension://abcdefghijklmnop/content.js',
    ]) {
      expect(schema.safeParse({ ...error, source }).success).toBe(false);
    }
  });
});

describe('linksIn', () => {
  it('lists every outbound link the site renders, and the CV', async () => {
    const content = await contentOf({
      projects: [
        aProject({ slug: 'tuner' }),
        aProject({ slug: 'courier', order: 2, visibility: 'private', knowledge: [] }),
      ],
    });
    expect([...linksIn(content)].sort()).toEqual(
      [
        'mailto:ada@example.com',
        'https://github.com/ada',
        'https://www.linkedin.com/in/ada',
        '/cv.pdf',
        'https://tuner.example.com',
        'https://github.com/someone/tuner',
        'https://github.com/someone/tuner/blob/main/README.md',
        'https://courier.example.com',
      ].sort(),
    );
  });
});
