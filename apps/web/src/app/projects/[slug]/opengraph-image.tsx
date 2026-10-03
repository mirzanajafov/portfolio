import { notFound } from 'next/navigation';
import { content } from '@portfolio/content';
import { headlineFact } from '@/lib/format';
import { ogSize, renderCard, truncate } from '@/lib/og';

export const alt = 'Case study';
export const size = ogSize;
export const contentType = 'image/png';
export const dynamicParams = false;

export function generateStaticParams() {
  return content.projects
    .filter((project) => project.caseStudy)
    .map((project) => ({ slug: project.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = content.projects.find((candidate) => candidate.slug === slug);
  if (!project) {
    notFound();
  }
  return renderCard({
    eyebrow: `Case study · ${content.profile.name}`,
    title: project.name,
    subtitle: truncate(project.hook, 52),
    footer: truncate(headlineFact(project).text, 110),
  });
}
