import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CvPage from './page';

vi.mock('@portfolio/content', async () => {
  const { aCv, aRole, contentModule, contentOf } = await import('@portfolio/content/testing');
  return contentModule(
    await contentOf({
      cv: aCv({
        experience: [
          aRole({
            company: 'Northwind',
            role: 'Backend Engineer',
            from: '2025-01',
            highlights: ['Cut the queue to 6 ms.'],
          }),
          aRole({
            company: undefined,
            role: 'Freelance Backend Developer',
            kind: 'freelance',
            from: '2024-01',
          }),
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
});
