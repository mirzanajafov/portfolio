import { content, projectsWithCaseStudy } from '@portfolio/content';
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

describe('the real content', () => {
  it('renders the home page with a tour stop for every project and no phone number', () => {
    const { container } = render(<Home />);
    expect(container.textContent).not.toMatch(phoneNumber);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(content.profile.name);
    for (const project of content.projects) {
      expect(screen.getByRole('heading', { level: 3, name: project.name })).toBeInTheDocument();
    }
  });

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
    'renders the case study of %s',
    async (slug, name) => {
      render(await CaseStudyPage({ params: Promise.resolve({ slug }) }));
      expect(screen.getByRole('heading', { level: 1, name })).toBeInTheDocument();
    },
  );
});
