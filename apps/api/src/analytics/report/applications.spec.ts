import { describe, expect, it } from 'vitest';
import { aDemoSite, aDemoView, anApplication, aView, aVisit, hoursAgo, now } from '../testing.js';
import type { VisitRow } from '../visits.js';
import { applicationsOf } from './applications.js';
import type { ApplicationRow, RolledApplicationDay } from './rows.js';

const labels = new Map([['/cv.pdf', 'CV PDF']]);

const demos = new Map([['tuner', aDemoSite()]]);

const applied = (code: string, overrides: Partial<ApplicationRow> = {}) =>
  anApplication({ id: code, code, ...overrides });

function sectionOf(
  rows: VisitRow[],
  applications: ApplicationRow[] = [anApplication()],
  rolled: RolledApplicationDay[] = [],
  asked = new Map<string, string[]>(),
) {
  return applicationsOf(rows, applications, rolled, labels, asked, demos, now);
}

describe('applicationsOf', () => {
  it('tells each coded visit page by page, newest first, with the blocks read, the clicks and no interaction', () => {
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
        at: hoursAgo(1),
        from: null,
        pages: [{ demo: null, path: '/', seconds: 0, read: [], did: [] }],
        clicks: [],
        questions: [],
        interacted: false,
      },
      {
        at: hoursAgo(3),
        from: 'www.linkedin.com',
        pages: [
          { demo: null, path: '/', seconds: 40, read: ['tuner'], did: [] },
          { demo: null, path: '/cv', seconds: 8, read: [], did: [] },
        ],
        clicks: ['CV PDF'],
        questions: [],
        interacted: true,
      },
    ]);
  });

  it('counts a visit that only asked a question as one with interaction', () => {
    const { list } = sectionOf(
      [aVisit([aView({ ref: 'memh', activeSeconds: 0 })], { visitor: 'asker' })],
      [anApplication()],
      [],
      new Map([['asker', ['Do you know Go?']]]),
    );
    expect(list[0]?.visits).toMatchObject([{ questions: ['Do you know Go?'], interacted: true }]);
  });

  it('adds the days that were rolled up, newest first', () => {
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
      { day: '2026-09-20', visits: 1, views: 2 },
      { day: '2026-09-12', visits: 2, views: 5 },
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

  it('lists the newest visits first, whatever order the rows came in', () => {
    const { list } = sectionOf([
      aVisit([aView({ createdAt: hoursAgo(1), ref: 'memh', path: '/cv' })], {
        startedAt: hoursAgo(1),
      }),
      aVisit([aView({ createdAt: hoursAgo(5), ref: 'memh' })], { startedAt: hoursAgo(5) }),
    ]);
    expect(list[0]?.visits.map(({ at }) => at)).toEqual([hoursAgo(1), hoursAgo(5)]);
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

  it("puts a visit's demo pages in its story, in time order with the site's, by host and with the steps done there", () => {
    const { list } = sectionOf([
      aVisit(
        [
          aView({ createdAt: hoursAgo(3), ref: 'memh', activeSeconds: 40 }),
          aView({ createdAt: hoursAgo(1), path: '/cv', activeSeconds: 8 }),
        ],
        {
          demoViews: [
            aDemoView({ createdAt: hoursAgo(2), activeSeconds: 140, actions: ['answered'] }),
          ],
        },
      ),
    ]);
    expect(list[0]?.visits[0]?.pages).toEqual([
      { demo: null, path: '/', seconds: 40, read: [], did: [] },
      {
        demo: 'tuner.najafov.dev',
        path: '/',
        seconds: 140,
        read: [],
        did: ['answered a question'],
      },
      { demo: null, path: '/cv', seconds: 8, read: [], did: [] },
    ]);
  });

  it("takes a story's source from its first page, a demo page included, and counts time on a demo as interaction", () => {
    const { list } = sectionOf([
      aVisit([aView({ createdAt: hoursAgo(1), ref: 'memh', activeSeconds: 0 })], {
        startedAt: hoursAgo(2),
        demoViews: [
          aDemoView({ createdAt: hoursAgo(2), referrerHost: 'github.com', activeSeconds: 90 }),
        ],
      }),
    ]);
    expect(list[0]?.visits[0]).toMatchObject({ from: 'github.com', interacted: true });
  });

  it('names a direct arrival at a demo as direct, even when the site page after it came from elsewhere', () => {
    const { list } = sectionOf([
      aVisit([aView({ createdAt: hoursAgo(1), ref: 'memh', referrerHost: 'www.linkedin.com' })], {
        demoViews: [aDemoView({ createdAt: hoursAgo(2), referrerHost: null })],
      }),
    ]);
    expect(list[0]?.visits[0]?.from).toBeNull();
  });

  it("puts a visit that went from the CV straight to a demo under its application, outside the guesser's score", () => {
    const { list, score } = sectionOf([
      aVisit([], {
        demoViews: [
          aDemoView({ ref: 'memh', referrerHost: null, activeSeconds: 60, actions: ['answered'] }),
        ],
      }),
    ]);
    expect(list[0]?.visits).toEqual([
      {
        at: hoursAgo(1),
        from: null,
        pages: [
          {
            demo: 'tuner.najafov.dev',
            path: '/',
            seconds: 60,
            read: [],
            did: ['answered a question'],
          },
        ],
        clicks: [],
        questions: [],
        interacted: true,
      },
    ]);
    expect(score.visits).toBe(0);
  });

  it('takes the first code of a visit, from either kind of page', () => {
    const { list } = sectionOf(
      [
        aVisit([aView({ createdAt: hoursAgo(2), ref: 'k7mpx' })], {
          startedAt: hoursAgo(3),
          demoViews: [aDemoView({ createdAt: hoursAgo(3), ref: 'memh' })],
        }),
      ],
      [anApplication(), anApplication({ id: 'local', code: 'k7mpx', company: 'Local' })],
    );
    expect(list.find(({ code }) => code === 'memh')?.visits).toHaveLength(1);
    expect(list.find(({ code }) => code === 'k7mpx')?.visits).toEqual([]);
  });

  it('never guesses a visit that saw only a demo', () => {
    const { list } = sectionOf(
      [aVisit([], { demoViews: [aDemoView()] })],
      [anApplication({ city: 'Baku' })],
    );
    expect(list[0]?.guesses).toEqual([]);
  });

  it('lists a visit that went from the CV to a demo and on to the site under its application, and checks the guesser on it', () => {
    const { list, score } = sectionOf(
      [
        aVisit([aView({ createdAt: hoursAgo(1) })], {
          startedAt: hoursAgo(2),
          demoViews: [aDemoView({ createdAt: hoursAgo(2), ref: 'memh' })],
        }),
      ],
      [anApplication({ city: 'Baku' })],
    );
    expect(list[0]?.visits).toHaveLength(1);
    expect(list[0]?.guesses).toEqual([]);
    expect(score).toMatchObject({ visits: 1, levels: { medium: { right: 1 } } });
  });

  it('gives each application its channel, variant, status and the days to its first answer', () => {
    const { list } = sectionOf(
      [],
      [
        anApplication({
          status: 'screening',
          appliedOn: new Date('2026-10-20'),
          answeredOn: new Date('2026-10-23'),
        }),
      ],
    );

    expect(list[0]).toMatchObject({
      channel: 'direct',
      cvVariant: 'base',
      status: 'screening',
      daysToAnswer: 3,
    });
  });

  it('tallies by channel and by variant, counting answers and their median only among applications past the guess window', () => {
    const { byChannel, byVariant } = sectionOf(
      [],
      [
        applied('kxqtz', {
          channel: 'referral',
          appliedOn: new Date('2026-10-01'),
          answeredOn: new Date('2026-10-03'),
          firstSeenOn: new Date('2026-10-02'),
        }),
        applied('mpw7r', { channel: 'referral', appliedOn: new Date('2026-10-15') }),
        applied('k7mpx', {
          channel: 'referral',
          appliedOn: new Date('2026-10-16'),
          answeredOn: new Date('2026-10-17'),
        }),
        applied('memh', {
          cvVariant: 'payments',
          appliedOn: new Date('2026-10-25'),
          answeredOn: new Date('2026-10-26'),
        }),
      ],
    );

    expect(byChannel).toEqual([
      { name: 'referral', applications: 3, opened: 1, oldEnough: 2, answered: 1, medianDays: 2 },
      { name: 'direct', applications: 1, opened: 0, oldEnough: 0, answered: 0, medianDays: null },
    ]);
    expect(byVariant.map(({ name, applications }) => [name, applications])).toEqual([
      ['base', 3],
      ['payments', 1],
    ]);
  });

  it('counts the 14 days in Baku days, so an application turns old enough at 20:00 UTC', () => {
    const oldEnoughAt = (time: string) =>
      applicationsOf(
        [],
        [
          applied('kxqtz', { appliedOn: new Date('2026-10-15') }),
          applied('mpw7r', { appliedOn: new Date('2026-10-16') }),
        ],
        [],
        labels,
        new Map(),
        demos,
        new Date(`2026-10-29T${time}Z`),
      ).byChannel[0]?.oldEnough;

    expect(oldEnoughAt('19:59:59')).toBe(0);
    expect(oldEnoughAt('20:00:00')).toBe(1);
  });
});
