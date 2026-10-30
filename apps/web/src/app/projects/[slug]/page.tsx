import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { type ReactNode, ViewTransition } from 'react';
import {
  content,
  findProjectWithCaseStudy,
  projectsWithCaseStudy,
  type Fact,
} from '@portfolio/content';
import { ProjectUses } from '@/components/project-uses';
import { ScenePlayer } from '@/components/scene-player';
import { StackList } from '@/components/stack-list';
import { factKindLabel } from '@/lib/format';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return projectsWithCaseStudy.map((project) => ({ slug: project.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const project = findProjectWithCaseStudy(slug);
  if (!project) {
    return {};
  }
  return {
    title: `${project.name} · ${content.profile.name}`,
    description: project.hook,
  };
}

function Section({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={className} data-read={id}>
      <h2 id={id} className="font-mono text-xs tracking-[0.12em] text-muted uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FactLine({ fact }: { fact: Fact }) {
  const { href } = fact.source;
  return (
    <li className="flex flex-col gap-1 border-l-2 border-accent pl-4">
      <span>{fact.text}</span>
      <span className="font-mono text-xs text-muted">
        {factKindLabel(fact.kind)}
        {' · '}
        {href ? (
          <a className="underline underline-offset-4" href={href}>
            {fact.source.file}
          </a>
        ) : (
          <span>{fact.source.file} (private repo)</span>
        )}
      </span>
    </li>
  );
}

export default async function CaseStudyPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const project = findProjectWithCaseStudy(slug);
  if (!project) {
    notFound();
  }
  const { caseStudy } = project;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-14 px-4 py-10 sm:px-8 sm:py-14">
      <nav aria-label="Breadcrumb" className="font-mono text-sm text-muted">
        <Link className="underline underline-offset-4" href="/">
          {content.profile.name}
        </Link>
        {' / '}
        <span>{project.name}</span>
      </nav>

      <header className="flex flex-col gap-4">
        <ViewTransition name={`project-${project.slug}`} share="morph" default="none">
          <h1 className="text-[clamp(40px,6vw,72px)] leading-[0.95] font-extrabold tracking-[-0.03em]">
            {project.name}
          </h1>
        </ViewTransition>
        <p className="text-xl text-soft">{project.hook}</p>
        <StackList stack={project.stack} />
        <ProjectUses uses={project.uses} />
        <div className="flex flex-wrap gap-4">
          <a
            className="font-medium text-accent underline underline-offset-4"
            href={project.links.live}
          >
            Live
          </a>
          {project.links.repo ? (
            <a className="font-medium underline underline-offset-4" href={project.links.repo}>
              Code
            </a>
          ) : (
            <span className="text-sm text-muted">Source available on request</span>
          )}
        </div>
      </header>

      <Section id="problem" title="Why I built it" className="flex flex-col gap-3">
        <p className="max-w-[65ch] text-xl leading-relaxed">{caseStudy.problem}</p>
      </Section>

      {caseStudy.demo && caseStudy.demoCaption && (
        <figure className="flex flex-col gap-3" data-read="demo">
          <div className="relative h-[clamp(420px,62vh,620px)] overflow-hidden rounded-2xl border border-line">
            <ScenePlayer scene={{ name: caseStudy.demo }} description={caseStudy.demoCaption} />
          </div>
          <figcaption className="max-w-[65ch] text-sm text-muted">
            {caseStudy.demoCaption}
          </figcaption>
        </figure>
      )}

      <Section id="decisions" title="Decisions" className="flex flex-col gap-10">
        {caseStudy.decisions.map((decision, index) => (
          <article
            key={decision.title}
            className="flex flex-col gap-4"
            data-read={`decision-${index + 1}`}
          >
            <h3 className="text-2xl font-bold tracking-tight">{decision.title}</h3>
            <p className="max-w-[65ch] leading-relaxed">{decision.body}</p>
            {decision.facts.length > 0 && (
              <ul className="flex flex-col gap-3">
                {decision.facts.map((fact) => (
                  <FactLine key={fact.id} fact={fact} />
                ))}
              </ul>
            )}
          </article>
        ))}
      </Section>

      <Section id="proof" title="How I know it works" className="flex flex-col gap-3">
        <p className="max-w-[65ch] leading-relaxed">{caseStudy.proof}</p>
      </Section>

      <Section id="next" title="What I would do next" className="flex flex-col gap-3">
        <p className="max-w-[65ch] leading-relaxed">{caseStudy.next}</p>
      </Section>

      <footer className="border-t border-line pt-8 text-muted">
        <Link className="underline underline-offset-4" href="/">
          Back to everything I built
        </Link>
      </footer>
    </main>
  );
}
