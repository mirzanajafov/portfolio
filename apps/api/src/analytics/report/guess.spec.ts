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

function companiesOf(row: VisitRow, applications: ApplicationRow[]) {
  return guess(row, applications)?.candidates.map(({ application }) => application.company);
}

const fromNetwork = (network: string) => aVisit([aView()], { network, city: null });

describe('guessOf', () => {
  it("places a visit from the company's own network with high confidence", () => {
    expect(guess(fromNetwork('XSOLLA LIMITED'), [anApplication()])).toEqual({
      confidence: 'high',
      candidates: [
        {
          application: anApplication(),
          signals: [{ kind: 'network', name: 'XSOLLA LIMITED' }],
          daysAfter: 1,
        },
      ],
    });
  });

  it('matches a name only as whole words of the network', () => {
    expect(
      guess(fromNetwork('Motorola Solutions, Inc.'), [anApplication({ company: 'Ola' })]),
    ).toBeNull();
    expect(guess(fromNetwork('PASHA Holding LLC'), [anApplication({ company: 'ING' })])).toBeNull();
    expect(
      guess(fromNetwork('ING Bank N.V.'), [anApplication({ company: 'ING' })])?.confidence,
    ).toBe('high');
  });

  it('folds accents, and never matches a name with no letters it can compare', () => {
    expect(
      guess(fromNetwork('Societe Generale SA'), [anApplication({ company: 'Société Générale' })])
        ?.confidence,
    ).toBe('high');
    expect(
      guess(aVisit([aView({ referrerHost: 'boards.greenhouse.io' })], { city: null }), [
        anApplication({ company: '!!!', atsHost: 'boards.greenhouse.io' }),
      ])?.confidence,
    ).toBe('medium');
  });

  it('uses only the network names registered with an application when there are any', () => {
    const cloudflare = anApplication({ company: 'Cloudflare', networks: ['CLOUDFLARE-CORP'] });
    expect(guess(fromNetwork('Cloudflare, Inc.'), [cloudflare])).toBeNull();
    expect(guess(fromNetwork('CLOUDFLARE-CORP'), [cloudflare])?.confidence).toBe('high');
  });

  it('trusts an ATS host that names the company more than a shared one', () => {
    const from = (host: string) => aVisit([aView({ referrerHost: host })], { city: null });
    const workday = anApplication({ atsHost: 'xsolla.wd3.myworkdayjobs.com' });
    const ultipro = anApplication({ company: 'ING', atsHost: 'recruiting.ultipro.com' });
    expect(guess(from('xsolla.wd3.myworkdayjobs.com'), [workday])?.confidence).toBe('high');
    expect(guess(from('recruiting.ultipro.com'), [ultipro])?.confidence).toBe('medium');
  });

  it('counts the same city in the same country as medium, and only the same country as low', () => {
    const baku = anApplication({ country: 'AZ', city: 'baku' });
    expect(guess(aVisit(), [baku])).toMatchObject({
      confidence: 'medium',
      candidates: [
        {
          signals: [
            { kind: 'city', city: 'Baku' },
            { kind: 'country', country: 'AZ' },
          ],
        },
      ],
    });
    expect(guess(aVisit([aView()], { city: 'Ganja' }), [baku])?.confidence).toBe('low');
    expect(guess(aVisit([aView()], { country: 'US' }), [baku])).toBeNull();
  });

  it('counts days from the application in Baku time, from the day itself to 14 days after', () => {
    const baku = anApplication({ city: 'Baku' });
    const at = (startedAt: string) =>
      guess(aVisit([aView()], { startedAt: new Date(startedAt) }), [baku]);
    expect(at('2026-10-28T19:59:00Z')).toBeNull();
    expect(at('2026-10-28T20:00:00Z')?.candidates[0]?.daysAfter).toBe(0);
    expect(at('2026-11-12T19:59:00Z')?.candidates[0]?.daysAfter).toBe(14);
    expect(at('2026-11-12T20:00:00Z')).toBeNull();
  });

  it('names every application that matches as well as the best one', () => {
    const xsolla = anApplication({ city: 'Baku' });
    const local = anApplication({ id: 'local', company: 'Local', city: 'Baku' });
    expect(companiesOf(aVisit(), [xsolla, local])).toEqual(['Xsolla', 'Local']);
  });

  it('prefers the stronger match, and between equally strong ones the match with more signals', () => {
    const xsolla = anApplication({ city: 'Baku' });
    const acme = anApplication({ id: 'acme', company: 'Acme', networks: ['ACME-NET'] });
    expect(companiesOf(aVisit([aView()], { network: 'ACME-NET' }), [xsolla, acme])).toEqual([
      'Acme',
    ]);
    const onGreenhouse = anApplication({ city: 'Baku', atsHost: 'boards.greenhouse.io' });
    const local = anApplication({ id: 'local', company: 'Local', city: 'Baku' });
    expect(
      companiesOf(aVisit([aView({ referrerHost: 'boards.greenhouse.io' })]), [onGreenhouse, local]),
    ).toEqual(['Xsolla']);
  });

  it('gives up when nothing but the time matches', () => {
    expect(guess(aVisit(), [anApplication()])).toBeNull();
  });
});
