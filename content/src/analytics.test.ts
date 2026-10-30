import { describe, expect, it } from 'vitest';
import { readingBlocks } from './analytics.ts';
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
