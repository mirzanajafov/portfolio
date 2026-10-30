import { aProject, contentOf } from '@portfolio/content/testing';
import { describe, expect, it } from 'vitest';
import { outboundLinks } from './links.js';

describe('outboundLinks', () => {
  it('names every outbound link the site renders, the CV and the IP database credit', async () => {
    const content = await contentOf({
      projects: [
        aProject({ slug: 'tuner', name: 'Tuner' }),
        aProject({
          slug: 'courier',
          name: 'Courier',
          order: 2,
          visibility: 'private',
          knowledge: [],
        }),
      ],
    });
    expect(outboundLinks(content)).toEqual([
      { href: 'mailto:ada@example.com', label: 'email' },
      { href: 'https://github.com/ada', label: 'GitHub' },
      { href: 'https://www.linkedin.com/in/ada', label: 'LinkedIn' },
      { href: '/cv.pdf', label: 'CV PDF' },
      { href: 'https://db-ip.com', label: 'DB-IP credit' },
      { href: 'https://tuner.example.com', label: 'Tuner live' },
      { href: 'https://github.com/someone/tuner', label: 'Tuner repo' },
      { href: 'https://github.com/someone/tuner/blob/main/README.md', label: 'Tuner README.md' },
      { href: 'https://courier.example.com', label: 'Courier live' },
    ]);
  });
});
