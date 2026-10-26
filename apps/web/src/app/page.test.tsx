import { render, screen, within } from '@testing-library/react';
import { assert, describe, expect, it, vi } from 'vitest';
import Home from './page';

vi.mock('@portfolio/content', async () => {
  const { aCv, aFact, aProfile, aProject, aRole, contentModule, contentOf } =
    await import('@portfolio/content/testing');
  return contentModule(
    await contentOf({
      profile: aProfile({
        name: 'Ada Lovelace',
        headline: 'Senior Backend Engineer',
        location: 'Baku, Azerbaijan',
        timezone: 'UTC+4',
        availability: 'Open to remote roles',
        links: {
          email: 'ada@example.com',
          github: 'https://github.com/ada',
          linkedin: 'https://www.linkedin.com/in/ada',
        },
      }),
      projects: [
        aProject({
          slug: 'open',
          name: 'Open',
          links: { live: 'https://open.example.com', repo: 'https://github.com/someone/open' },
          headline: 'fast',
          facts: [aFact({ id: 'fast', text: 'Answers in 40 ms.', kind: 'measured' })],
        }),
        aProject({
          slug: 'closed',
          name: 'Closed',
          order: 2,
          visibility: 'private',
          links: { live: 'https://closed.example.com' },
          headline: 'flush',
          facts: [aFact({ id: 'flush', text: 'Flushes every 150 ms.', kind: 'parameter' })],
        }),
      ],
      cv: aCv({
        experience: [
          aRole({ company: 'Northwind', kind: 'contract' }),
          aRole({ company: undefined, role: 'Freelance Backend Developer', kind: 'freelance' }),
          aRole({ company: 'Acme', kind: 'employee' }),
        ],
      }),
    }),
  );
});

function itemOf(element: HTMLElement): HTMLElement {
  const item = element.closest('li');
  assert(item, `${element.textContent} is not in a list`);
  return item;
}

describe('home page', () => {
  it('gives a recruiter the name, role, location and a way to get in touch without any script', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Baku, Azerbaijan · UTC+4 · Open to remote roles')).toBeInTheDocument();
    const contact = within(screen.getByRole('navigation', { name: 'Contact' }));
    expect(contact.getByRole('link', { name: 'Email me' })).toHaveAttribute(
      'href',
      'mailto:ada@example.com',
    );
    expect(contact.getByRole('link', { name: 'CV' })).toHaveAttribute('href', '/cv');
  });

  it('repeats the CV and profiles at the bottom, so nobody scrolls back up to leave', () => {
    render(<Home />);
    const elsewhere = within(screen.getByRole('navigation', { name: 'Elsewhere' }));
    expect(elsewhere.getByRole('link', { name: 'CV' })).toHaveAttribute('href', '/cv');
    expect(elsewhere.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/ada',
    );
    expect(elsewhere.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/ada',
    );
  });

  it('shows every project with a live link, and links code only for public repos', () => {
    render(<Home />);
    const open = within(screen.getByRole('article', { name: 'Open' }));
    expect(open.getByRole('link', { name: 'Code' })).toHaveAttribute(
      'href',
      'https://github.com/someone/open',
    );
    const closed = within(screen.getByRole('article', { name: 'Closed' }));
    expect(closed.getByRole('link', { name: 'Live' })).toHaveAttribute(
      'href',
      'https://closed.example.com',
    );
    expect(closed.queryByRole('link', { name: 'Code' })).toBeNull();
    expect(closed.getByText('Source available on request')).toBeInTheDocument();
  });

  it('never dresses a design parameter up as a measurement', () => {
    render(<Home />);
    const parameter = within(screen.getByRole('article', { name: 'Closed' }));
    expect(parameter.getByText('design parameter')).toBeInTheDocument();
    const measured = within(screen.getByRole('article', { name: 'Open' }));
    expect(measured.queryByText('design parameter')).toBeNull();
  });

  it('labels contract and freelance roles so overlapping dates read the same as on the CV', () => {
    render(<Home />);
    const northwind = itemOf(screen.getByRole('heading', { name: /Northwind/ }));
    expect(within(northwind).getByText('Contract')).toBeInTheDocument();
    const freelance = itemOf(screen.getByRole('heading', { name: 'Freelance Backend Developer' }));
    expect(within(freelance).getByText('Freelance')).toBeInTheDocument();
    const acme = itemOf(screen.getByRole('heading', { name: /Acme/ }));
    expect(within(acme).queryByText('Contract')).toBeNull();
  });
});
