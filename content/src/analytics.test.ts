import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { backupDays, demoSites, readingBlocks } from './analytics.ts';
import { aCaseStudy, aProject, contentOf } from './testing.ts';

describe('readingBlocks', () => {
  it('lists the reading blocks of the home page and of every case study in page order', async () => {
    const content = await contentOf({
      projects: [
        aProject({
          slug: 'shown',
          caseStudy: aCaseStudy({ demo: 'storm', demoCaption: 'A storm of requests.' }),
        }),
        aProject({
          slug: 'told',
          order: 2,
          caseStudy: aCaseStudy({
            decisions: [
              { title: 'One', body: 'First.', facts: [] },
              { title: 'Two', body: 'Second.', facts: [] },
              { title: 'Three', body: 'Third.', facts: [] },
            ],
          }),
        }),
        aProject({ slug: 'listed', order: 3 }),
      ],
    });
    expect(readingBlocks(content)).toEqual(
      new Map([
        ['/', ['shown', 'told', 'listed', 'ask', 'experience']],
        ['/projects/shown', ['problem', 'demo', 'decision-1', 'decision-2', 'proof', 'next']],
        ['/projects/told', ['problem', 'decision-1', 'decision-2', 'decision-3', 'proof', 'next']],
      ]),
    );
  });
});

describe('demoSites', () => {
  it('maps the origin of each demo that records visits to its project and its actions', async () => {
    const content = await contentOf({
      projects: [
        aProject({
          slug: 'alpha',
          name: 'Alpha',
          links: {
            live: 'https://alpha.najafov.dev/start',
            repo: 'https://github.com/someone/alpha',
          },
          analytics: { actions: { 'ran-it': 'ran it' } },
        }),
        aProject({ slug: 'beta', order: 2 }),
      ],
    });
    expect(demoSites(content)).toEqual(
      new Map([
        [
          'https://alpha.najafov.dev',
          {
            slug: 'alpha',
            name: 'Alpha',
            live: 'https://alpha.najafov.dev/start',
            host: 'alpha.najafov.dev',
            actions: { 'ran-it': 'ran it' },
          },
        ],
      ]),
    );
  });
});

describe('backupDays', () => {
  it('is the age at which the backup deletes a dump', () => {
    const script = readFileSync(new URL('../../deploy/backup/backup.sh', import.meta.url), 'utf8');
    expect(script).toMatch(new RegExp(`^KEEP_DAYS=${String(backupDays)}$`, 'm'));
  });
});
