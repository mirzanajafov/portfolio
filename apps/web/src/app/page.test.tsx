import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from './page';

describe('home page', () => {
  it('gives a recruiter the name, role, location and a way to get in touch without any script', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1, name: 'Mirza Najafov' })).toBeInTheDocument();
    expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText(/Open to remote roles and relocation/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email me' })).toHaveAttribute(
      'href',
      'mailto:mirza@najafov.dev',
    );
  });
});
