import { render, screen, within } from '@testing-library/react';
import { assert, describe, expect, it, vi } from 'vitest';
import CaseStudyPage, { generateStaticParams } from './page';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not found');
  },
}));

vi.mock('@portfolio/content', async () => {
  const { aCaseStudy, aFact, aProject, contentModule, contentOf } =
    await import('@portfolio/content/testing');
  return contentModule(
    await contentOf({
      projects: [
        aProject({
          slug: 'open',
          name: 'Open',
          links: { live: 'https://open.example.com', repo: 'https://github.com/someone/open' },
          headline: 'fast',
          facts: [
            aFact({ id: 'fast', text: 'It answers in 40 ms.', source: { file: 'README.md' } }),
            aFact({
              id: 'small',
              text: 'It keeps one table.',
              kind: 'design',
              source: { file: 'schema.sql' },
            }),
            aFact({
              id: 'flush',
              text: 'It flushes every 150 ms.',
              kind: 'parameter',
              source: { file: 'flush.ts' },
            }),
          ],
          uses: [{ project: 'closed', for: 'its queue' }],
          caseStudy: aCaseStudy({
            decisions: [
              { title: 'Measure first', body: 'I measured.', facts: ['fast', 'small', 'flush'] },
              { title: 'Keep it small', body: 'I kept it small.', facts: [] },
            ],
          }),
        }),
        aProject({
          slug: 'closed',
          name: 'Closed',
          order: 2,
          visibility: 'private',
          headline: 'queue',
          facts: [aFact({ id: 'queue', text: 'It queues offline.', source: { file: 'queue.ts' } })],
          caseStudy: aCaseStudy({
            decisions: [
              { title: 'Queue offline', body: 'I queue offline.', facts: ['queue'] },
              { title: 'Keep it small', body: 'I kept it small.', facts: [] },
            ],
          }),
        }),
        aProject({ slug: 'plain', name: 'Plain', order: 3 }),
      ],
    }),
  );
});

async function renderCaseStudy(slug: string) {
  render(await CaseStudyPage({ params: Promise.resolve({ slug }) }));
}

function decision(title: string): HTMLElement {
  const article = screen.getByRole('heading', { name: title }).closest('article');
  assert(article, `${title} is not in an article`);
  return article;
}

describe('case study pages', () => {
  it('exist exactly for the projects that have a case study', () => {
    expect(generateStaticParams().map((params) => params.slug)).toEqual(['open', 'closed']);
  });

  it('shows every decision with the facts behind it and where each fact comes from', async () => {
    await renderCaseStudy('open');
    const measured = within(decision('Measure first'));
    expect(measured.getByText('It answers in 40 ms.')).toBeInTheDocument();
    expect(measured.getByRole('link', { name: 'README.md' })).toHaveAttribute(
      'href',
      'https://github.com/someone/open/blob/main/README.md',
    );
  });

  it('labels every fact behind a decision by what kind of number it is', async () => {
    await renderCaseStudy('open');
    const measured = within(decision('Measure first'));
    expect(measured.getAllByText(/^measured/)).toHaveLength(1);
    expect(measured.getAllByText(/^design parameter/)).toHaveLength(1);
    expect(measured.getAllByText(/^design ·|^design$/)).toHaveLength(1);
  });

  it('names the file of a private repo without linking to it', async () => {
    await renderCaseStudy('closed');
    const queue = within(decision('Queue offline'));
    expect(queue.getByText('queue.ts (private repo)')).toBeInTheDocument();
    expect(queue.queryByRole('link')).toBeNull();
  });

  it('links to the tour stop of a project this one uses', async () => {
    await renderCaseStudy('open');
    expect(screen.getByRole('link', { name: 'Closed' })).toHaveAttribute('href', '/#closed');
  });

  it('refuses a project without a case study', async () => {
    await expect(CaseStudyPage({ params: Promise.resolve({ slug: 'plain' }) })).rejects.toThrow(
      'not found',
    );
  });
});
