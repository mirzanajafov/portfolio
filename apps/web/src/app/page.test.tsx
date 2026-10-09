import { content } from '@portfolio/content';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from './page';

describe('home page', () => {
  it('gives a recruiter the name, role, location and a way to get in touch without any script', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1, name: 'Mirza Najafov' })).toBeInTheDocument();
    expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText(/Open to remote roles and relocation/)).toBeInTheDocument();
    const contact = within(screen.getByRole('navigation', { name: 'Contact' }));
    expect(contact.getByRole('link', { name: 'Email me' })).toHaveAttribute(
      'href',
      'mailto:mirza@najafov.dev',
    );
    expect(contact.getByRole('link', { name: 'CV' })).toHaveAttribute('href', '/cv');
  });

  it('repeats the CV and profiles at the bottom, so nobody scrolls back up to leave', () => {
    render(<Home />);
    const elsewhere = within(screen.getByRole('navigation', { name: 'Elsewhere' }));
    expect(elsewhere.getByRole('link', { name: 'CV' })).toHaveAttribute('href', '/cv');
    expect(elsewhere.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      content.profile.links.github,
    );
    expect(elsewhere.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      content.profile.links.linkedin,
    );
  });

  it('shows every project with a live link, and links code only for public repos', () => {
    render(<Home />);
    const matchium = screen.getByRole('article', { name: 'Matchium' });
    expect(within(matchium).getByRole('link', { name: 'Code' })).toHaveAttribute(
      'href',
      'https://github.com/mirzanajafov/matchium',
    );
    const tmPost = screen.getByRole('article', { name: 'TM Post' });
    expect(within(tmPost).getByRole('link', { name: 'Live' })).toHaveAttribute(
      'href',
      'https://tmpost.najafov.dev',
    );
    expect(within(tmPost).queryByRole('link', { name: 'Code' })).toBeNull();
    expect(within(tmPost).getByText('Source available on request')).toBeInTheDocument();
  });

  it('never dresses a design parameter up as a measurement', () => {
    render(<Home />);
    for (const project of content.projects) {
      const headline = project.facts.find((fact) => fact.id === project.headline);
      const card = screen.getByRole('article', { name: project.name });
      const label = within(card).queryByText('design parameter');
      if (headline?.kind === 'parameter') {
        expect(label, project.name).toBeInTheDocument();
      } else {
        expect(label, project.name).toBeNull();
      }
    }
  });

  it('labels contract and freelance roles so overlapping dates read the same as on the CV', () => {
    render(<Home />);
    const thinkingIt = screen.getByRole('heading', { name: /Thinking IT/ }).parentElement;
    expect(thinkingIt).not.toBeNull();
    expect(within(thinkingIt as HTMLElement).getByText('Contract')).toBeInTheDocument();
  });
});
