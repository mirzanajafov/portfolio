import { content } from '@portfolio/content';
import { ogSize, renderCard } from '@/lib/og';

export const alt = `${content.profile.name}, ${content.profile.headline}`;
export const size = ogSize;
export const contentType = 'image/png';

export default async function Image() {
  const { profile } = content;
  return renderCard({
    eyebrow: `${profile.location} · ${profile.availability}`,
    title: profile.name,
    subtitle: profile.headline,
    footer: `${content.projects.length} projects with sourced facts, and a box that answers questions about me.`,
  });
}
