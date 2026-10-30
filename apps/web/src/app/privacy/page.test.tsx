import { content } from '@portfolio/content';
import { analyticsDays } from '@portfolio/content/analytics';
import { askLogDays } from '@portfolio/content/ask';
import { phoneNumber } from '@portfolio/content/testing';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacyPage from './page';

describe('the privacy page', () => {
  it('says how long visits and questions are kept, from the numbers the API uses', () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).toContain(
      `These records are deleted after ${analyticsDays} days.`,
    );
    expect(container.textContent).toContain(`I keep questions for ${askLogDays} days`);
  });

  it('credits DB-IP and gives the address to write to, and no phone number', () => {
    const { container } = render(<PrivacyPage />);
    expect(screen.getByRole('link', { name: 'IP Geolocation by DB-IP' })).toHaveAttribute(
      'href',
      'https://db-ip.com',
    );
    expect(screen.getByRole('link', { name: content.profile.links.email })).toHaveAttribute(
      'href',
      `mailto:${content.profile.links.email}`,
    );
    expect(container.textContent).not.toMatch(phoneNumber);
  });
});
