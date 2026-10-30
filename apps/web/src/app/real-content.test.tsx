import { content, projectsWithCaseStudy } from '@portfolio/content';
import { readingBlocks } from '@portfolio/content/analytics';
import { phoneNumber } from '@portfolio/content/testing';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CvPage from './cv/page';
import Home from './page';
import CaseStudyPage from './projects/[slug]/page';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not found');
  },
}));

function readingOrder(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('[data-read]')].map((block) =>
    block.getAttribute('data-read'),
  );
}

describe('the real content', () => {
  it('renders the home page with a tour stop for every project and no phone number', () => {
    const { container } = render(<Home />);
    expect(container.textContent).not.toMatch(phoneNumber);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(content.profile.name);
    for (const project of content.projects) {
      expect(screen.getByRole('heading', { level: 3, name: project.name })).toBeInTheDocument();
    }
  });

  it('marks the reading blocks of the home page in the order the report lists them', () => {
    const { container } = render(<Home />);
    expect(readingOrder(container)).toEqual(readingBlocks(content).get('/'));
  });

  it.each(projectsWithCaseStudy.map(({ slug }) => [slug]))(
    'marks the reading blocks of the case study of %s in the order the report lists them',
    async (slug) => {
      const { container } = render(await CaseStudyPage({ params: Promise.resolve({ slug }) }));
      expect(readingOrder(container)).toEqual(readingBlocks(content).get(`/projects/${slug}`));
    },
  );

  it('renders the CV with every role and no phone number', () => {
    const { container } = render(<CvPage />);
    expect(container.textContent).not.toMatch(phoneNumber);
    expect(
      screen.getByRole('heading', { level: 1, name: content.profile.name }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(
      content.cv.experience.length + content.cv.mentoring.length,
    );
  });

  it.each(projectsWithCaseStudy.map((project) => [project.slug, project.name]))(
    'renders the case study of %s with no phone number',
    async (slug, name) => {
      const { container } = render(await CaseStudyPage({ params: Promise.resolve({ slug }) }));
      expect(screen.getByRole('heading', { level: 1, name })).toBeInTheDocument();
      expect(container.textContent).not.toMatch(phoneNumber);
    },
  );
});
