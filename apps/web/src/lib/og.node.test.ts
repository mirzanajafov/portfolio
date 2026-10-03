import { describe, expect, it } from 'vitest';
import { renderCard, truncate } from './og';

describe('renderCard', () => {
  it('renders a 1200 by 630 PNG with the site fonts', async () => {
    const response = await renderCard({
      eyebrow: 'Baku',
      title: 'Mirza Najafov',
      subtitle: 'Senior Backend Engineer',
      footer: 'Projects with sourced facts.',
    });
    const png = Buffer.from(await response.arrayBuffer());
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  }, 30_000);
});

describe('truncate', () => {
  it('cuts on a word boundary and marks the cut', () => {
    expect(truncate('one two three four', 11)).toBe('one two…');
    expect(truncate('short', 11)).toBe('short');
  });
});
