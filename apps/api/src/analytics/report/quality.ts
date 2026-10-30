import type { Rating, Report, Vital } from './report.js';
import type { Visit } from './rows.js';
import { groupBy, percentile } from './statistics.js';

type Bars = { good: number; poor: number; mine: number };

const lcpBars: Bars = { good: 2500, poor: 4000, mine: 2000 };
const inpBars: Bars = { good: 200, poor: 500, mine: 200 };
const clsBars: Bars = { good: 0.1, poor: 0.25, mine: 0.05 };

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
  return groupBy(measured, ({ view }) => view.path).flatMap(([path, onPath]) =>
    groupBy(onPath, ({ device }) => device).map(([device, here]) => ({
      path,
      device,
      lcp: vitalOf(
        here.flatMap(({ view }) => view.lcpMs ?? []),
        lcpBars,
      ),
      inp: vitalOf(
        here.flatMap(({ view }) => view.inpMs ?? []),
        inpBars,
      ),
      cls: vitalOf(
        here.flatMap(({ view }) => view.cls ?? []),
        clsBars,
      ),
    })),
  );
}

function errorsOf(visits: readonly Visit[]): Report['quality']['errors'] {
  const errors = visits.flatMap(({ browser, views }) =>
    views.flatMap(({ path, errors }) => errors.map((error) => ({ ...error, path, browser }))),
  );
  return groupBy(errors, ({ source }) => source)
    .flatMap(([source, fromSource]) =>
      groupBy(fromSource, ({ message }) => message).map(([message, same]) => ({
        message,
        source,
        count: same.length,
        paths: [...new Set(same.map(({ path }) => path))].toSorted(),
        browsers: [...new Set(same.map(({ browser }) => browser))].toSorted(),
      })),
    )
    .toSorted((a, b) => b.count - a.count);
}

function notFoundOf(visits: readonly Visit[]): Report['quality']['notFound'] {
  const missing = visits.flatMap(({ views }) => views.filter(({ notFound }) => notFound));
  return groupBy(missing, ({ path }) => path).map(([path, views]) => ({
    path,
    views: views.length,
    referrers: [...new Set(views.flatMap(({ referrerHost }) => referrerHost ?? []))].toSorted(),
  }));
}

export function qualityOf(visits: readonly Visit[]): Report['quality'] {
  return { vitals: vitalsOf(visits), errors: errorsOf(visits), notFound: notFoundOf(visits) };
}
