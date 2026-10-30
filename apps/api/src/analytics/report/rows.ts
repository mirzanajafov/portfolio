import type { DayTotals } from '../day-totals.js';
import type { DropReason } from '../visit-log.service.js';
import type { VisitRow } from '../visits.js';

export type ReportRows = {
  rawFrom: Date;
  visits: VisitRow[];
  rolled: (DayTotals & { day: Date })[];
  questions: { createdAt: Date; refused: boolean }[];
  dropped: { day: Date; reason: DropReason; count: number }[];
};
