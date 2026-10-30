import type { DayTotals } from '../day-totals.js';
import type { DropReason } from '../visit-log.service.js';
import type { VisitRow } from '../visits.js';

export type ApplicationRow = {
  id: string;
  code: string;
  company: string;
  role: string;
  appliedOn: Date;
  country: string | null;
  city: string | null;
  atsHost: string | null;
  networks: string[];
};

export type RolledApplicationDay = {
  day: Date;
  applicationId: string;
  visits: number;
  views: number;
};

export type ReportRows = {
  rawFrom: Date;
  visits: VisitRow[];
  rolled: (DayTotals & { day: Date })[];
  questions: { createdAt: Date; refused: boolean }[];
  dropped: { day: Date; reason: DropReason; count: number }[];
  applications: ApplicationRow[];
  rolledApplications: RolledApplicationDay[];
};
