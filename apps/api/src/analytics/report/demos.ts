import type { DemoSite } from '@portfolio/content/analytics';
import type { Report } from '@portfolio/content/report';
import type { DayTotals } from '../day-totals.js';
import { demoTotals, touched } from '../demos.js';
import { median } from '../statistics.js';
import type { VisitRow } from '../visits.js';

export function demosOf(
  rows: readonly VisitRow[],
  { visits, openedDemo, didDemoStep }: DayTotals,
  demos: readonly DemoSite[],
): Report['demos'] {
  return {
    visits,
    opened: openedDemo,
    didStep: didDemoStep,
    demoOnly: rows.filter(({ views, demoViews }) => views.length === 0 && demoViews.length > 0)
      .length,
    list: demos.flatMap((site) => {
      const totals = demoTotals(rows, site);
      if (!touched(totals)) {
        return [];
      }
      return [
        {
          name: site.name,
          host: site.host,
          clicked: totals.clicked,
          fromSite: totals.fromSite,
          clickedNotOpened: totals.clickedNotOpened,
          demoOnly: totals.demoOnly,
          didStep: totals.didStep,
          steps: Object.entries(site.actions).map(([name, label]) => ({
            label,
            visits: totals.steps.find((step) => step.name === name)?.visits ?? 0,
          })),
          medianSeconds: median(totals.activeSeconds),
        },
      ];
    }),
  };
}
