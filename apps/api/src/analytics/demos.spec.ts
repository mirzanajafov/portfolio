import { describe, expect, it } from 'vitest';
import { demoTotals } from './demos.js';
import { aDemoSite, aDemoView, aView, aVisit } from './testing.js';

const tuner = aDemoSite();

const clickedTuner = aView({ clicks: [{ href: 'https://tuner.najafov.dev' }] });

describe('demoTotals', () => {
  it('counts the site visits that clicked the live link, opened the demo, or clicked and never arrived', () => {
    const totals = demoTotals(
      [
        aVisit([clickedTuner], { demoViews: [aDemoView()] }),
        aVisit([clickedTuner]),
        aVisit([aView()], { demoViews: [aDemoView()] }),
        aVisit([aView()]),
      ],
      tuner,
    );
    expect(totals).toMatchObject({ clicked: 2, fromSite: 2, clickedNotOpened: 1, demoOnly: [] });
  });

  it('counts a visit that saw only the demo apart, by where it came from', () => {
    const totals = demoTotals(
      [
        aVisit([], { demoViews: [aDemoView({ referrerHost: 'github.com' })] }),
        aVisit([], { demoViews: [aDemoView({ referrerHost: 'github.com' })] }),
        aVisit([], { demoViews: [aDemoView({ referrerHost: null })] }),
      ],
      tuner,
    );
    expect(totals).toMatchObject({
      fromSite: 0,
      demoOnly: [
        { source: 'github', visits: 2 },
        { source: 'direct', visits: 1 },
      ],
    });
  });

  it('counts each step once a visit, and the seconds of every visit that opened the demo', () => {
    const totals = demoTotals(
      [
        aVisit([aView()], {
          demoViews: [
            aDemoView({ activeSeconds: 30, actions: ['answered'] }),
            aDemoView({ path: '/chats', activeSeconds: 10, actions: ['answered'] }),
          ],
        }),
        aVisit([], { demoViews: [aDemoView({ activeSeconds: 5 })] }),
        aVisit([aView()], { demoViews: [aDemoView({ demo: 'poof', actions: ['poofed'] })] }),
      ],
      tuner,
    );
    expect(totals).toMatchObject({
      didStep: 1,
      steps: [{ name: 'answered', visits: 1 }],
      activeSeconds: [40, 5],
    });
  });
});
