import type { Content } from '@portfolio/content';
import { demoSites } from '@portfolio/content/analytics';
import type { Report } from '@portfolio/content/report';
import { dayTotals } from '../day-totals.js';
import { demoTotals } from '../demos.js';
import { median } from '../statistics.js';
import { inOrder, type VisitRow } from '../visits.js';

export function demosOf(rows: readonly VisitRow[], content: Content): Report['demos'] {
  const { visits, openedDemo, didDemoStep } = dayTotals(rows.flatMap(inOrder));
  return {
    visits,
    opened: openedDemo,
    didStep: didDemoStep,
    demoOnly: rows.filter(({ views, demoViews }) => views.length === 0 && demoViews.length > 0)
      .length,
    list: [...demoSites(content).values()].flatMap((site) => {
      const totals = demoTotals(rows, site);
      if (totals.clicked === 0 && totals.activeSeconds.length === 0) {
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
