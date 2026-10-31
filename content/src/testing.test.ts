import { describe, expect, it } from 'vitest';
import { aFact, aProject, contentOf, pausePunctuation } from './testing.ts';

describe('contentOf', () => {
  it('links the facts of a public project to its repo, as the loader does', async () => {
    const { projects } = await contentOf({
      projects: [
        aProject({
          slug: 'open',
          links: { live: 'https://open.example.com', repo: 'https://github.com/someone/open' },
          headline: 'fast',
          facts: [aFact({ id: 'fast', source: { file: 'README.md' } })],
        }),
      ],
    });
    expect(projects[0]?.headline.source.href).toBe(
      'https://github.com/someone/open/blob/main/README.md',
    );
  });

  it('refuses content the loader would refuse', async () => {
    await expect(
      contentOf({
        projects: [
          aProject({
            visibility: 'private',
            links: {
              live: 'https://closed.example.com',
              repo: 'https://github.com/someone/closed',
            },
          }),
        ],
      }),
    ).rejects.toThrow('a private repo must not be linked');
  });

  it('refuses two projects with the same slug instead of keeping one', async () => {
    await expect(contentOf({ projects: [aProject(), aProject({ order: 2 })] })).rejects.toThrow(
      'two fixture projects use the slug demo',
    );
  });
});

describe('pausePunctuation', () => {
  it.each(['a; b', 'a \u2014 b', 'a - b', 'a -- b'])('finds a pause in %j', (text) => {
    expect(text).toMatch(pausePunctuation);
  });

  it.each(['36-40%', 'Sep 2025 \u2013 present', 'read-only', 'Ctrl-C'])(
    'lets %j through',
    (text) => {
      expect(text).not.toMatch(pausePunctuation);
    },
  );
});
