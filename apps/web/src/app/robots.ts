import type { MetadataRoute } from 'next';
import { siteUrl } from '@portfolio/content';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/api/' }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
