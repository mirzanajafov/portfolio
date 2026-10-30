import type { MetadataRoute } from 'next';
import { projectsWithCaseStudy, siteUrl } from '@portfolio/content';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/cv`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${siteUrl}/cv.pdf`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    ...projectsWithCaseStudy.map((project) => ({
      url: `${siteUrl}/projects/${project.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
