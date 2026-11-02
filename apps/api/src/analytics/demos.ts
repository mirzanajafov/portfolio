import type { DemoSite } from '@portfolio/content/analytics';
import type { Source } from '@portfolio/content/report';
import { sourceOf } from './sources.js';
import { tally } from './statistics.js';
import type { VisitRow } from './visits.js';

export type DemoTotals = {
  demo: string;
  clicked: number;
  fromSite: number;
  clickedNotOpened: number;
  demoOnly: { source: Source; visits: number }[];
  didStep: number;
  steps: { name: string; visits: number }[];
  activeSeconds: number[];
};

export function touched({ clicked, activeSeconds }: DemoTotals): boolean {
  return clicked > 0 || activeSeconds.length > 0;
}

export function demoTotals(rows: readonly VisitRow[], { slug, live }: DemoSite): DemoTotals {
  const clickedIn = rows.filter(({ views }) =>
    views.some(({ clicks }) => clicks.some(({ href }) => href === live)),
  );
  const openings = rows.flatMap(({ views, demoViews, browser }) => {
    const opened = demoViews.filter(({ demo }) => demo === slug);
    const [arrival] = opened;
    return arrival
      ? [
          {
            fromSite: views.length > 0,
            source: sourceOf(arrival.referrerHost, browser),
            steps: [...new Set(opened.flatMap(({ actions }) => actions))],
            seconds: opened.reduce((sum, { activeSeconds }) => sum + activeSeconds, 0),
          },
        ]
      : [];
  });
  return {
    demo: slug,
    clicked: clickedIn.length,
    fromSite: openings.filter(({ fromSite }) => fromSite).length,
    clickedNotOpened: clickedIn.filter(
      ({ demoViews }) => !demoViews.some(({ demo }) => demo === slug),
    ).length,
    demoOnly: tally(
      openings.filter(({ fromSite }) => !fromSite),
      ({ source }) => source,
    ).map(([source, visits]) => ({ source, visits })),
    didStep: openings.filter(({ steps }) => steps.length > 0).length,
    steps: tally(
      openings.flatMap(({ steps }) => steps),
      (name) => name,
    ).map(([name, visits]) => ({ name, visits })),
    activeSeconds: openings.map(({ seconds }) => seconds),
  };
}
