import { assert, describe, expect, it } from 'vitest';
import { anApplication, aView, aVisit } from '../testing.js';
import { inOrder, type VisitRow } from '../visits.js';
import { guessOf } from './guess.js';
import type { ApplicationRow } from './rows.js';

function guess(row: VisitRow, applications: ApplicationRow[]) {
  const [visit] = inOrder(row);
  assert(visit);
  return guessOf(visit, applications);
}

const wolt = anApplication({ id: 'wolt', code: 'k7mpx', company: 'Wolt' });

describe('guessOf', () => {
  it("places a visit from the company's own network with high confidence", () => {
    expect(
      guess(aVisit([aView()], { network: 'XSOLLA LIMITED' }), [anApplication(), wolt]),
    ).toEqual({
      confidence: 'high',
      candidates: [
        {
          application: anApplication(),
          reasons: ['network XSOLLA LIMITED', '1 day after applying'],
        },
      ],
    });
  });

  it('uses the network names registered with an application', () => {
    const globex = anApplication({ company: 'Globex', networks: ['ACME-NET'] });
    expect(guess(aVisit([aView()], { network: 'AcmeNet Ltd' }), [globex])?.confidence).toBe('high');
    expect(
      guess(aVisit([aView()], { network: 'AcmeNet Ltd' }), [anApplication({ company: 'Globex' })]),
    ).toBeNull();
  });

  it('trusts an ATS host that names the company more than a shared one', () => {
    const workday = anApplication({ atsHost: 'xsolla.wd3.myworkdayjobs.com' });
    const greenhouse = anApplication({ atsHost: 'boards.greenhouse.io' });
    const from = (host: string) => aVisit([aView({ referrerHost: host })], { city: null });
    expect(guess(from('xsolla.wd3.myworkdayjobs.com'), [workday])?.confidence).toBe('high');
    expect(guess(from('boards.greenhouse.io'), [greenhouse])?.confidence).toBe('medium');
  });

  it('counts the same city as medium and only the same country as low', () => {
    const baku = anApplication({ country: 'AZ', city: 'Baku' });
    expect(guess(aVisit(), [baku])).toMatchObject({
      confidence: 'medium',
      candidates: [{ reasons: ['Baku', 'AZ', '1 day after applying'] }],
    });
    expect(guess(aVisit([aView()], { city: 'Ganja' }), [baku])?.confidence).toBe('low');
  });

  it('only places visits from the day of the application to 14 days after', () => {
    const baku = anApplication({ city: 'Baku' });
    const on = (startedAt: string) =>
      guess(aVisit([aView()], { startedAt: new Date(startedAt) }), [baku]);
    expect(on('2026-10-28T23:59:00Z')).toBeNull();
    expect(on('2026-10-29T00:00:00Z')?.candidates[0]?.reasons).toContain('0 days after applying');
    expect(on('2026-11-12T23:59:00Z')?.candidates[0]?.reasons).toContain('14 days after applying');
    expect(on('2026-11-13T00:00:00Z')).toBeNull();
  });

  it('names every application that matches as well as the best one', () => {
    const xsolla = anApplication({ city: 'Baku' });
    const local = anApplication({ id: 'local', company: 'Local', city: 'Baku' });
    expect(
      guess(aVisit(), [xsolla, local])?.candidates.map(({ application }) => application.company),
    ).toEqual(['Xsolla', 'Local']);
  });

  it('prefers the application that matches more strongly', () => {
    const xsolla = anApplication({ city: 'Baku' });
    const acme = anApplication({ id: 'acme', company: 'Acme', networks: ['ACME-NET'] });
    expect(
      guess(aVisit([aView()], { network: 'ACME-NET' }), [xsolla, acme])?.candidates.map(
        ({ application }) => application.company,
      ),
    ).toEqual(['Acme']);
  });

  it('leaves a visit that carries a code alone, and one that only matches in time', () => {
    const baku = anApplication({ city: 'Baku' });
    expect(guess(aVisit([aView({ ref: 'check1' })]), [baku])).toBeNull();
    expect(guess(aVisit(), [anApplication()])).toBeNull();
  });
});
