import { content } from '@portfolio/content';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CaseStudyPage, { generateStaticParams } from './page';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not found');
  },
}));

async function renderCaseStudy(slug: string) {
  render(await CaseStudyPage({ params: Promise.resolve({ slug }) }));
}

describe('case study pages', () => {
  it('exist exactly for the projects that have a case study', () => {
    const withStudies = content.projects.filter((p) => p.caseStudy).map((p) => p.slug);
    expect(generateStaticParams().map((p) => p.slug)).toEqual(withStudies);
    expect(withStudies.length).toBeGreaterThan(0);
  });

  it('shows every decision with the facts behind it and where each fact comes from', async () => {
    await renderCaseStudy('matchium');
    const decision = screen.getByRole('heading', {
      name: 'Share the attention fairly',
    }).parentElement;
    expect(decision).not.toBeNull();
    const fact = within(decision as HTMLElement).getByText(/Gini of 0\.46 to 0\.02/);
    expect(fact).toBeInTheDocument();
    expect(
      within(decision as HTMLElement).getByRole('link', { name: 'README.md' }),
    ).toHaveAttribute('href', 'https://github.com/mirzanajafov/matchium/blob/main/README.md');
  });

  it('labels every fact behind a decision by what kind of number it is', async () => {
    await renderCaseStudy('marauder');
    const decision = screen.getByRole('heading', { name: 'Measure before tuning' }).parentElement;
    expect(within(decision as HTMLElement).getAllByText(/^measured/)).toHaveLength(2);
    expect(within(decision as HTMLElement).getAllByText(/^design ·|^design$/)).toHaveLength(1);
    expect(within(decision as HTMLElement).queryByText(/design parameter/)).toBeNull();
  });

  it('refuses a project without a case study', async () => {
    await expect(CaseStudyPage({ params: Promise.resolve({ slug: 'tm-post' }) })).rejects.toThrow(
      'not found',
    );
  });
});
