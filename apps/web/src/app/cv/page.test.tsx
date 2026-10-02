import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CvPage from './page';

describe('CV page', () => {
  it('lists every role with its highlights, newest first', () => {
    render(<CvPage />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings[0]).toContain('NeuroTime AI');
    expect(headings).toContainEqual(expect.stringContaining('DIV Academy'));
    expect(screen.getByText(/PHP to NestJS and TypeScript/)).toBeInTheDocument();
  });

  it('names a freelance role without inventing a company for it', () => {
    render(<CvPage />);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Freelance Backend Developer' }),
    ).toBeInTheDocument();
  });

  it('carries no phone number', () => {
    const { container } = render(<CvPage />);
    expect(container.textContent).not.toMatch(/\+994/);
  });
});
