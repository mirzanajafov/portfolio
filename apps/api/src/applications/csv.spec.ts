import { describe, expect, it } from 'vitest';
import type { Application } from '../generated/prisma/client.js';
import { applicationsCsv } from './csv.js';

const anApplicationRow = (overrides: Partial<Application> = {}): Application => ({
  id: '019a3b6e-0000-7000-8000-000000000001',
  code: 'memh',
  company: 'Acme',
  role: 'Backend Engineer',
  appliedOn: new Date('2026-10-30'),
  createdAt: new Date('2026-10-30T09:00:00Z'),
  country: null,
  city: null,
  atsHost: null,
  networks: [],
  firstSeenOn: null,
  channel: 'direct',
  cvVariant: 'base 2026-10-30',
  status: 'sent',
  answeredOn: null,
  notes: '',
  ...overrides,
});

describe('applicationsCsv', () => {
  it("writes career's columns in career's order, with an empty file still having its header", () => {
    expect(applicationsCsv([])).toBe(
      'company,role,date,cv_variant,channel,ref,status,days_to_first_answer,notes\n',
    );
  });

  it('writes an unanswered application with a blank days to first answer', () => {
    expect(applicationsCsv([anApplicationRow()]).split('\n')[1]).toBe(
      'Acme,Backend Engineer,2026-10-30,base 2026-10-30,direct,memh,sent,,',
    );
  });

  it('counts the days from applying to the first answer', () => {
    const answered = anApplicationRow({ status: 'screening', answeredOn: new Date('2026-11-04') });
    expect(applicationsCsv([answered]).split('\n')[1]).toBe(
      'Acme,Backend Engineer,2026-10-30,base 2026-10-30,direct,memh,screening,5,',
    );
  });

  it('quotes a field with a comma, a quote or a line break, and doubles its quotes', () => {
    const notes = 'Applied through the form, "website" field.\nSecond line.';
    const role = 'Middle/Senior Fullstack Developer, Baku';
    expect(applicationsCsv([anApplicationRow({ role, notes })])).toBe(
      'company,role,date,cv_variant,channel,ref,status,days_to_first_answer,notes\n' +
        'Acme,"Middle/Senior Fullstack Developer, Baku",2026-10-30,base 2026-10-30,direct,memh,sent,,' +
        '"Applied through the form, ""website"" field.\nSecond line."\n',
    );
  });
});
