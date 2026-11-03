import { content } from '@portfolio/content';
import {
  analyticsDays,
  backupDays,
  dailyTotalsMonths,
  demoSites,
} from '@portfolio/content/analytics';
import { askLogDays } from '@portfolio/content/ask';
import { pausePunctuation, phoneNumber } from '@portfolio/content/testing';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacyPage from './page';

describe('the privacy page', () => {
  it('says how long visits and questions are kept, from the numbers the API uses', () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).toContain(
      `These records are deleted once their UTC day is ${String(analyticsDays)} full days old, so each lives ${String(analyticsDays)} to ${String(analyticsDays + 1)} days.`,
    );
    expect(container.textContent).toContain(
      `For each day I keep, for ${String(dailyTotalsMonths)} months, how long each visit lasted`,
    );
    expect(container.textContent).toContain(`I keep questions for ${askLogDays} days`);
    expect(container.textContent).toContain(
      'With Global Privacy Control or Do Not Track on, a question is still answered and kept, but tied to no visit.',
    );
  });

  it('says how long a backup can keep a deleted record, from the number the backup uses', () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).toContain(
      `so a deleted record can stay in a backup for up to ${String(backupDays + 1)} more days.`,
    );
  });

  it('names every demo that records visits and the steps it records, where the demos link to', () => {
    render(<PrivacyPage />);
    const part = screen.getByRole('heading', { name: 'Demos' }).closest('section');
    expect(part).toHaveAttribute('id', 'demos');
    const items = [...(part?.querySelectorAll('li') ?? [])].map(({ textContent }) => textContent);
    expect(items).toEqual(
      [...demoSites(content).values()].map(
        ({ name, host, actions }) => `${name} (${host}): ${Object.values(actions).join(', ')}`,
      ),
    );
    expect(items).toContain('Matchium (matchium.najafov.dev): answered a question');
    expect(part?.textContent).toContain(
      `For each day I keep, for ${String(dailyTotalsMonths)} months, how many visits clicked a link to each demo, opened it and from which kind of site they came, how many did each step and how long they stayed.`,
    );
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
    expect(container.textContent).not.toMatch(pausePunctuation);
  });
});
