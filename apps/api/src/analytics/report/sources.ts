import type { Source } from './report.js';

const google = /^(?:www\.)?google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/;

const domains: [Source, string[]][] = [
  ['google', ['com.google.android.googlequicksearchbox']],
  [
    'search',
    [
      'bing.com',
      'duckduckgo.com',
      'yandex.ru',
      'yandex.com',
      'ya.ru',
      'search.yahoo.com',
      'ecosia.org',
      'search.brave.com',
      'baidu.com',
    ],
  ],
  ['linkedin', ['linkedin.com', 'lnkd.in', 'com.linkedin.android']],
  ['github', ['github.com']],
  [
    'jobs',
    [
      'myworkdayjobs.com',
      'greenhouse.io',
      'lever.co',
      'ashbyhq.com',
      'smartrecruiters.com',
      'workable.com',
      'recruitee.com',
      'teamtailor.com',
      'bamboohr.com',
      'personio.de',
      'personio.com',
      'indeed.com',
      'glassdoor.com',
      'djinni.co',
      'wellfound.com',
      'hh.ru',
      'boss.az',
      'jobsearch.az',
    ],
  ],
  ['demos', ['najafov.dev']],
];

function within(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function sourceOf(referrerHost: string | null, browser: string): Source {
  if (referrerHost === null) {
    return browser === 'linkedin' ? 'linkedin' : 'direct';
  }
  if (google.test(referrerHost)) {
    return 'google';
  }
  const known = domains.find(([, list]) => list.some((domain) => within(referrerHost, domain)));
  return known?.[0] ?? 'other';
}
