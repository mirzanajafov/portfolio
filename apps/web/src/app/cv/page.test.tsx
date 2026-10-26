import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CvPage from './page';

vi.mock('@portfolio/content', async () => {
  const { aCv, aRole, contentModule, someContent } = await import('@portfolio/content/testing');
  return contentModule(
    someContent({
      cv: aCv({
        experience: [
          aRole({ company: 'Northwind', from: '2025-01', highlights: ['Cut the queue to 6 ms.'] }),
          aRole({ company: undefined, role: 'Freelance Backend Developer', kind: 'freelance' }),
        ],
        mentoring: [aRole({ company: 'Code School', role: 'Mentor', kind: 'part-time' })],
      }),
    }),
  );
});

describe('CV page', () => {
  it('lists every role with its highlights in the order the CV gives them', () => {
    render(<CvPage />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual([
      'Backend Engineer at Northwind',
      'Freelance Backend Developer',
      'Mentor at Code School',
    ]);
    expect(screen.getByText('Cut the queue to 6 ms.')).toBeInTheDocument();
  });

  it('names a freelance role without inventing a company for it', () => {
    render(<CvPage />);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Freelance Backend Developer' }),
    ).toBeInTheDocument();
  });
});
