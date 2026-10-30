import { isQuickExit, secondsOf, type Visit } from './visits.js';

export type DayTotals = {
  visits: number;
  pageViews: number;
  phoneVisits: number;
  quickExits: number;
  visitSeconds: number[];
};

export function dayTotals(visits: readonly Visit[]): DayTotals {
  return {
    visits: visits.length,
    pageViews: visits.reduce((total, { views }) => total + views.length, 0),
    phoneVisits: visits.filter(({ device }) => device === 'phone').length,
    quickExits: visits.filter(isQuickExit).length,
    visitSeconds: visits.map(secondsOf),
  };
}
