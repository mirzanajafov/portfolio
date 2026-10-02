import type { Profile } from '@portfolio/content';

export function personJsonLd(profile: Profile, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    alternateName: profile.alternateNames,
    jobTitle: profile.headline,
    url,
    email: `mailto:${profile.links.email}`,
    address: { '@type': 'PostalAddress', addressLocality: profile.location },
    sameAs: [profile.links.github, profile.links.linkedin],
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
