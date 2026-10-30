import type { DropReason } from '../visit-log.service.js';
import type { VisitRow } from '../visits.js';

export type ReportRows = {
  kept: Date;
  visits: VisitRow[];
  questions: { createdAt: Date; refused: boolean }[];
  dropped: { day: Date; reason: DropReason; count: number }[];
};
