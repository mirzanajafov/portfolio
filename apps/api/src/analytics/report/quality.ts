import type { Rating, Report, Vital } from './report.js';
import type { Visit } from './rows.js';
import { percentile, rankedGroups } from './statistics.js';

type Bars = { good: number; poor: number; mine: number };

export const vitalBars = {
  lcp: { good: 2500, poor: 4000, mine: 2000 },
  inp: { good: 200, poor: 500, mine: 200 },
  cls: { good: 0.1, poor: 0.25, mine: 0.05 },
} satisfies Record<string, Bars>;

function ratingOf(p75: number, { good, poor }: Bars): Rating {
  if (p75 <= good) {
    return 'good';
  }
  return p75 <= poor ? 'needs improvement' : 'poor';
}

function vitalOf(values: number[], bars: Bars): Vital | null {
  const p75 = percentile(values, 0.75);
  if (p75 === null) {
    return null;
  }
  return { p75, samples: values.length, rating: ratingOf(p75, bars), overMyBar: p75 >= bars.mine };
}

function vitalsOf(visits: readonly Visit[]): Report['quality']['vitals'] {
  const measured = visits.flatMap(({ device, views }) =>
    views
      .filter(({ lcpMs, inpMs, cls }) => lcpMs !== null || inpMs !== null || cls !== null)
      .map((view) => ({ device, view })),
  );
  return rankedGroups(measured, ({ device, view }) => JSON.stringify([view.path, device])).map(
    ([, here]) => ({
      path: here[0].view.path,
      device: here[0].device,
      lcp: vitalOf(
        here.flatMap(({ view }) => view.lcpMs ?? []),
        vitalBars.lcp,
      ),
      inp: vitalOf(
        here.flatMap(({ view }) => view.inpMs ?? []),
        vitalBars.inp,
      ),
      cls: vitalOf(
        here.flatMap(({ view }) => view.cls ?? []),
        vitalBars.cls,
      ),
    }),
  );
}

function errorsOf(visits: readonly Visit[]): Report['quality']['errors'] {
  const errors = visits.flatMap(({ browser, views }) =>
    views.flatMap(({ path, errors }) => errors.map((error) => ({ ...error, path, browser }))),
  );
  return rankedGroups(errors, ({ source, message }) => JSON.stringify([source, message])).map(
    ([, same]) => ({
      message: same[0].message,
      source: same[0].source,
      count: same.length,
      paths: [...new Set(same.map(({ path }) => path))].toSorted(),
      browsers: [...new Set(same.map(({ browser }) => browser))].toSorted(),
    }),
  );
}

function notFoundOf(visits: readonly Visit[]): Report['quality']['notFound'] {
  const missing = visits.flatMap(({ views }) => views.filter(({ notFound }) => notFound));
  return rankedGroups(missing, ({ path }) => path).map(([path, views]) => ({
    path,
    views: views.length,
    referrers: [...new Set(views.flatMap(({ referrerHost }) => referrerHost ?? []))].toSorted(),
  }));
}

export function qualityOf(visits: readonly Visit[]): Report['quality'] {
  return { vitals: vitalsOf(visits), errors: errorsOf(visits), notFound: notFoundOf(visits) };
}
