import { describe, expect, it } from 'vitest';
import { aFact, aProject, contentOf } from './testing.ts';

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
