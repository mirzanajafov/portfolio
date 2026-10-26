import { notFound } from 'next/navigation';
import { content, findProjectWithCaseStudy, projectsWithCaseStudy } from '@portfolio/content';
import { ogSize, renderCard, truncate } from '@/lib/og';

export const alt = 'Case study';
export const size = ogSize;
export const contentType = 'image/png';
export const dynamicParams = false;

export function generateStaticParams() {
  return projectsWithCaseStudy.map((project) => ({ slug: project.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = findProjectWithCaseStudy(slug);
  if (!project) {
    notFound();
  }
  return renderCard({
    eyebrow: `Case study · ${content.profile.name}`,
    title: project.name,
    subtitle: truncate(project.hook, 72),
    footer: truncate(project.headline.text, 110),
  });
}
