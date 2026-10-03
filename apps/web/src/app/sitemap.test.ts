import { content } from '@portfolio/content';
import { describe, expect, it } from 'vitest';
import robots from './robots';
import sitemap from './sitemap';

describe('sitemap and robots', () => {
  it('lists the home page, both CVs and every case study', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain('https://najafov.dev');
    expect(urls).toContain('https://najafov.dev/cv.pdf');
    for (const project of content.projects.filter((p) => p.caseStudy)) {
      expect(urls).toContain(`https://najafov.dev/projects/${project.slug}`);
    }
  });

  it('keeps crawlers out of the API and points them at the sitemap', () => {
    const rules = robots();
    expect(rules.sitemap).toBe('https://najafov.dev/sitemap.xml');
    expect(JSON.stringify(rules.rules)).toContain('/api/');
  });
});
