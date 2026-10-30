import type { Content } from '@portfolio/content';
import { geolocationCredit } from '@portfolio/content/analytics';

export type OutboundLink = { href: string; label: string };

export function outboundLinks({ profile, projects }: Content): OutboundLink[] {
  return [
    { href: `mailto:${profile.links.email}`, label: 'email' },
    { href: profile.links.github, label: 'GitHub' },
    { href: profile.links.linkedin, label: 'LinkedIn' },
    { href: '/cv.pdf', label: 'CV PDF' },
    { href: geolocationCredit, label: 'DB-IP credit' },
    ...projects.flatMap(({ name, links, facts }) => [
      { href: links.live, label: `${name} live` },
      ...(links.repo ? [{ href: links.repo, label: `${name} repo` }] : []),
      ...facts.flatMap(({ source }) =>
        source.href ? [{ href: source.href, label: `${name} ${source.file}` }] : [],
      ),
    ]),
  ];
}
