import { describe, expect, it } from 'vitest';
import { anApplication, aView, aVisit, hoursAgo } from '../testing.js';
import { inOrder, type VisitRow } from '../visits.js';
import { applicationsOf } from './applications.js';
import type { ApplicationRow, RolledApplicationDay } from './rows.js';

const labels = new Map([['/cv.pdf', 'CV PDF']]);

function sectionOf(
  rows: VisitRow[],
  applications: ApplicationRow[] = [anApplication()],
  rolled: RolledApplicationDay[] = [],
) {
  return applicationsOf(rows.flatMap(inOrder), applications, rolled, labels);
}

describe('applicationsOf', () => {
  it('tells each coded visit page by page, with the blocks read, the clicks and no interaction', () => {
    const { list } = sectionOf([
      aVisit(
        [
          aView({
            createdAt: hoursAgo(3),
            ref: 'memh',
            referrerHost: 'www.linkedin.com',
            activeSeconds: 40,
            blocks: { tuner: 5, ask: 1 },
          }),
          aView({
            createdAt: hoursAgo(2),
            path: '/cv',
            activeSeconds: 8,
            clicks: [{ href: '/cv.pdf' }],
          }),
        ],
        { startedAt: hoursAgo(3) },
      ),
      aVisit([aView({ ref: 'memh', activeSeconds: 0 })]),
    ]);
    expect(list[0]?.visits).toEqual([
      {
        at: hoursAgo(3),
        from: 'www.linkedin.com',
        pages: [
          { path: '/', seconds: 40, read: ['tuner'] },
          { path: '/cv', seconds: 8, read: [] },
        ],
        clicks: ['CV PDF'],
        interacted: true,
      },
      {
        at: hoursAgo(1),
        from: null,
        pages: [{ path: '/', seconds: 0, read: [] }],
        clicks: [],
        interacted: false,
      },
    ]);
  });

  it('adds the days that were rolled up, oldest first', () => {
    const { list } = sectionOf(
      [],
      [anApplication()],
      [
        { day: new Date('2026-09-20'), applicationId: 'xsolla', visits: 1, views: 2 },
        { day: new Date('2026-09-12'), applicationId: 'xsolla', visits: 2, views: 5 },
        { day: new Date('2026-09-12'), applicationId: 'wolt', visits: 4, views: 4 },
      ],
    );
    expect(list[0]?.days).toEqual([
      { day: '2026-09-12', visits: 2, views: 5 },
      { day: '2026-09-20', visits: 1, views: 2 },
    ]);
  });

  it('shows a guessed visit under every company it could be, and never as a coded visit', () => {
    const xsolla = anApplication({ city: 'Baku' });
    const local = anApplication({ id: 'local', code: 'k7mpx', company: 'Local', city: 'Baku' });
    const { list } = sectionOf(
      [aVisit([aView({ referrerHost: 'www.google.com' })])],
      [xsolla, local],
    );
    expect(list.map(({ company, visits, guesses }) => [company, visits, guesses.length])).toEqual([
      ['Local', [], 1],
      ['Xsolla', [], 1],
    ]);
    expect(list[0]?.guesses[0]).toMatchObject({
      confidence: 'medium',
      candidates: [
        { company: 'Xsolla', role: 'Backend Engineer' },
        { company: 'Local', role: 'Backend Engineer' },
      ],
      signals: [{ kind: 'city', city: 'Baku' }],
      daysAfter: 1,
      from: 'www.google.com',
    });
  });

  it('never guesses a visit that came in with a code, even one that would match', () => {
    const { list } = sectionOf(
      [aVisit([aView({ ref: 'check1' })]), aVisit([aView({ ref: 'memh' })])],
      [anApplication({ city: 'Baku' })],
    );
    expect(list[0]?.visits).toHaveLength(1);
    expect(list[0]?.guesses).toEqual([]);
  });

  it('lists visits in the order they happened, whatever order the rows came in', () => {
    const { list } = sectionOf([
      aVisit([aView({ ref: 'memh', path: '/cv' })], { startedAt: hoursAgo(1) }),
      aVisit([aView({ ref: 'memh' })], { startedAt: hoursAgo(5) }),
    ]);
    expect(list[0]?.visits.map(({ at }) => at)).toEqual([hoursAgo(5), hoursAgo(1)]);
  });

  it('checks the guesser on the coded visits with their code hidden', () => {
    const xsolla = anApplication({ city: 'Baku' });
    const wolt = anApplication({ id: 'wolt', code: 'k7mpx', company: 'Wolt' });
    const { score } = sectionOf(
      [
        aVisit([aView({ ref: 'memh' })]),
        aVisit([aView({ ref: 'k7mpx' })]),
        aVisit([aView({ ref: 'memh' })], { city: null }),
      ],
      [xsolla, wolt],
    );
    expect(score).toEqual({
      visits: 3,
      unplaced: 1,
      levels: {
        high: { right: 0, wrong: 0, tied: 0 },
        medium: { right: 1, wrong: 1, tied: 0 },
        low: { right: 0, wrong: 0, tied: 0 },
      },
    });
  });

  it('counts a guess that names the right application with another as tied', () => {
    const xsolla = anApplication({ city: 'Baku' });
    const local = anApplication({ id: 'local', code: 'k7mpx', company: 'Local', city: 'Baku' });
    const { score } = sectionOf([aVisit([aView({ ref: 'memh' })])], [xsolla, local]);
    expect(score.levels.medium).toEqual({ right: 0, wrong: 0, tied: 1 });
  });

  it('lists the codes no application has, with their visits and when they were first seen', () => {
    const { unknownCodes } = sectionOf([
      aVisit([aView({ ref: 'check1' })], { startedAt: hoursAgo(5) }),
      aVisit([aView({ ref: 'check1' })], { startedAt: hoursAgo(2) }),
      aVisit([aView({ ref: 'memh' })]),
    ]);
    expect(unknownCodes).toEqual([{ code: 'check1', visits: 2, firstSeen: hoursAgo(5) }]);
  });

  it('lists the newest application first', () => {
    const { list } = sectionOf(
      [],
      [
        anApplication({ id: 'old', company: 'Old', appliedOn: new Date('2026-09-01') }),
        anApplication(),
      ],
    );
    expect(list.map(({ company }) => company)).toEqual(['Xsolla', 'Old']);
  });
});
