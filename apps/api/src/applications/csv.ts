import { dayOf, daysBetween } from '../common/days.js';
import type { Application } from '../generated/prisma/client.js';

const header = [
  'company',
  'role',
  'date',
  'cv_variant',
  'channel',
  'ref',
  'status',
  'days_to_first_answer',
  'notes',
];

function field(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function rowOf(application: Application): string[] {
  const { company, role, appliedOn, cvVariant, channel, code, status, answeredOn, notes } =
    application;
  return [
    company,
    role,
    dayOf(appliedOn),
    cvVariant,
    channel,
    code,
    status,
    answeredOn === null ? '' : String(daysBetween(appliedOn, answeredOn)),
    notes,
  ];
}

export function applicationsCsv(applications: readonly Application[]): string {
  return (
    [header, ...applications.map(rowOf)].map((row) => row.map(field).join(',')).join('\n') + '\n'
  );
}
