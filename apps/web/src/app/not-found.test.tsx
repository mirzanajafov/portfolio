import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NotFound from './not-found';

describe('the page for a missing address', () => {
  it('says so, links back home and marks itself for the visit count', () => {
    const { container } = render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("This page isn't here");
    expect(screen.getByRole('link', { name: 'Back to everything I built' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(container.querySelector('[data-not-found]')).not.toBeNull();
  });
});
