import { describe, expect, it } from 'vitest';
import type { Source } from './report.js';
import { sourceOf } from './sources.js';

describe('sourceOf', () => {
  it.each<[string | null, string, Source]>([
    ['www.google.com', 'chrome', 'google'],
    ['www.google.az', 'chrome', 'google'],
    ['www.google.co.uk', 'safari', 'google'],
    ['com.google.android.googlequicksearchbox', 'chrome', 'google'],
    ['www.bing.com', 'edge', 'search'],
    ['duckduckgo.com', 'firefox', 'search'],
    ['yandex.ru', 'chrome', 'search'],
    ['www.linkedin.com', 'chrome', 'linkedin'],
    ['lnkd.in', 'safari', 'linkedin'],
    [null, 'linkedin', 'linkedin'],
    ['github.com', 'chrome', 'github'],
    ['xsolla.wd3.myworkdayjobs.com', 'chrome', 'jobs'],
    ['boards.greenhouse.io', 'chrome', 'jobs'],
    ['jobs.lever.co', 'chrome', 'jobs'],
    ['matchium.najafov.dev', 'chrome', 'demos'],
    [null, 'chrome', 'direct'],
    ['news.ycombinator.com', 'chrome', 'other'],
    ['notgithub.com', 'chrome', 'other'],
    ['google.example.com', 'chrome', 'other'],
  ])('counts a landing from %s in %s as %s', (host, browser, source) => {
    expect(sourceOf(host, browser)).toBe(source);
  });
});
