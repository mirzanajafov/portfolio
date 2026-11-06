import { describe, expect, it } from 'vitest';
import { rollUp } from './roll-up.js';
import { aDemoSite, aDemoView, aView, aVisit, hoursAgo, inDataCenter } from './testing.js';

describe('rollUp', () => {
  it("adds up the day's visits and keeps every visit's seconds", () => {
    const day = rollUp(
      [
        aVisit([aView({ activeSeconds: 20 }), aView({ path: '/cv', activeSeconds: 40 })]),
        aVisit([aView({ activeSeconds: 4 })], { device: 'phone' }),
      ],
      [],
    );
    expect(day.totals).toEqual({
      visits: 2,
      pageViews: 3,
      phoneVisits: 1,
      quickExits: 1,
      visitSeconds: [60, 4],
      openedDemo: 0,
      didDemoStep: 0,
    });
  });

  it('rolls a day without visits up to zeros', () => {
    expect(rollUp([], [])).toEqual({
      totals: {
        visits: 0,
        pageViews: 0,
        phoneVisits: 0,
        quickExits: 0,
        visitSeconds: [],
        openedDemo: 0,
        didDemoStep: 0,
      },
      pages: [],
      sources: [],
      countries: [],
      clicks: [],
      applications: [],
      demos: [],
    });
  });

  it("keeps every view's seconds and scroll per page and device, with its visits and exits", () => {
    const day = rollUp(
      [
        aVisit([
          aView({ createdAt: hoursAgo(3), activeSeconds: 10, maxScroll: 40 }),
          aView({ createdAt: hoursAgo(2), path: '/cv', activeSeconds: 5, maxScroll: 100 }),
          aView({ createdAt: hoursAgo(1), activeSeconds: 30, maxScroll: 80 }),
        ]),
        aVisit([aView({ activeSeconds: 7, maxScroll: 20 })], { device: 'phone' }),
      ],
      [],
    );
    expect(
      day.pages.map(({ path, device, views, visits, exits, activeSeconds, maxScroll }) => ({
        path,
        device,
        views,
        visits,
        exits,
        activeSeconds,
        maxScroll,
      })),
    ).toEqual([
      {
        path: '/',
        device: 'desktop',
        views: 2,
        visits: 1,
        exits: 1,
        activeSeconds: [10, 30],
        maxScroll: [40, 80],
      },
      {
        path: '/',
        device: 'phone',
        views: 1,
        visits: 1,
        exits: 1,
        activeSeconds: [7],
        maxScroll: [20],
      },
      {
        path: '/cv',
        device: 'desktop',
        views: 1,
        visits: 1,
        exits: 0,
        activeSeconds: [5],
        maxScroll: [100],
      },
    ]);
  });

  it("counts 404 views apart from a page's views", () => {
    const [page] = rollUp([aVisit([aView({ path: '/old', notFound: true })])], []).pages;
    expect(page).toMatchObject({
      path: '/old',
      views: 0,
      visits: 0,
      exits: 0,
      notFoundViews: 1,
      activeSeconds: [],
    });
  });

  it('keeps the seconds of every view that spent time on a block, and the Web Vitals samples', () => {
    const [page] = rollUp(
      [
        aVisit([aView({ blocks: { problem: 4, proof: 0 }, lcpMs: 1800, cls: 0.02 })]),
        aVisit([aView({ blocks: { problem: 1, demo: 9 }, lcpMs: 2400, inpMs: 120 })]),
      ],
      [],
    ).pages;
    expect(page).toMatchObject({
      blockSeconds: { problem: [4, 1], demo: [9] },
      lcpMs: [1800, 2400],
      inpMs: [120],
      cls: [0.02],
    });
  });

  it('counts landings by source and the host they came from, and countries', () => {
    const day = rollUp(
      [
        aVisit([aView({ referrerHost: 'www.google.com' })]),
        aVisit([aView({ referrerHost: 'www.google.com' })], { country: null }),
        aVisit([aView()]),
      ],
      [],
    );
    expect(day.sources).toEqual([
      { source: 'google', host: 'www.google.com', visits: 2 },
      { source: 'direct', host: '', visits: 1 },
    ]);
    expect(day.countries).toEqual([
      { country: 'AZ', visits: 2 },
      { country: '', visits: 1 },
    ]);
  });

  it('counts clicks by the page they came from and the link', () => {
    const day = rollUp(
      [
        aVisit([
          aView({ path: '/cv', clicks: [{ href: '/cv.pdf' }, { href: '/cv.pdf' }] }),
          aView({ clicks: [{ href: '/cv.pdf' }] }),
        ]),
      ],
      [],
    );
    expect(day.clicks).toEqual([
      { path: '/cv', href: '/cv.pdf', clicks: 2 },
      { path: '/', href: '/cv.pdf', clicks: 1 },
    ]);
  });

  it('counts the visits and page views that came in with each code', () => {
    const day = rollUp(
      [
        aVisit([
          aView({ createdAt: hoursAgo(2), ref: 'memh' }),
          aView({ createdAt: hoursAgo(1), path: '/cv' }),
        ]),
        aVisit([aView({ ref: 'memh' })]),
        aVisit([aView()]),
      ],
      [],
    );
    expect(day.applications).toEqual([{ code: 'memh', visits: 2, views: 3 }]);
  });

  it('keeps each demo that anyone clicked or opened that day, and how many site visits opened one', () => {
    const day = rollUp(
      [aVisit([aView()], { demoViews: [aDemoView({ actions: ['answered'] })] }), aVisit([aView()])],
      [aDemoSite(), aDemoSite({ slug: 'poof', live: 'https://poof.najafov.dev' })],
    );
    expect(day.totals).toMatchObject({ visits: 2, openedDemo: 1, didDemoStep: 1 });
    expect(day.demos).toEqual([
      {
        demo: 'tuner',
        clicked: 0,
        fromSite: 1,
        clickedNotOpened: 0,
        demoOnly: [],
        didStep: 1,
        steps: [{ name: 'answered', visits: 1 }],
        activeSeconds: [20],
      },
    ]);
  });

  it('rolls up people only, a coded data-center visit included', () => {
    const day = rollUp(
      [
        aVisit([aView({ activeSeconds: 30 })], { visitor: 'person', country: 'AZ' }),
        aVisit([aView({ ref: 'memh', activeSeconds: 0 })], {
          visitor: 'scanner',
          country: 'US',
          ...inDataCenter('Microsoft Corporation'),
          demoViews: [aDemoView()],
        }),
      ],
      [aDemoSite()],
    );
    expect(day.totals).toMatchObject({ visits: 1, pageViews: 1, openedDemo: 0 });
    expect(day.countries).toEqual([{ country: 'AZ', visits: 1 }]);
    expect(day.pages.map(({ views }) => views)).toEqual([1]);
    expect(day.demos).toEqual([]);
    expect(day.applications).toEqual([]);
  });

  it('counts a visit that went from the CV straight to a demo for its code', () => {
    const day = rollUp(
      [aVisit([], { demoViews: [aDemoView({ ref: 'memh' }), aDemoView({ path: '/chats' })] })],
      [aDemoSite()],
    );
    expect(day.applications).toEqual([{ code: 'memh', visits: 1, views: 2 }]);
    expect(day.totals.visits).toBe(0);
  });
});
