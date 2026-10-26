import type { MetadataRoute } from 'next';
import { projectsWithCaseStudy } from '@portfolio/content';
import { siteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/cv`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${siteUrl}/cv.pdf`, changeFrequency: 'monthly', priority: 0.6 },
    ...projectsWithCaseStudy.map((project) => ({
      url: `${siteUrl}/projects/${project.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
