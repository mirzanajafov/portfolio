import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ViewTransition } from 'react';
import { content, type Fact, type Project } from '@portfolio/content';
import { ScenePlayer } from '@/components/scene-player';

type Params = { slug: string };

function withCaseStudy(slug: string) {
  const project = content.projects.find((candidate) => candidate.slug === slug);
  return project?.caseStudy ? { project, caseStudy: project.caseStudy } : undefined;
}

export function generateStaticParams(): Params[] {
  return content.projects
    .filter((project) => project.caseStudy)
    .map((project) => ({ slug: project.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const found = withCaseStudy((await params).slug);
  if (!found) {
    return {};
  }
  return {
    title: `${found.project.name} · ${content.profile.name}`,
    description: found.project.hook,
  };
}

function sourceHref(project: Project, fact: Fact): string | undefined {
  if (project.visibility !== 'public' || !project.links.repo) {
    return undefined;
  }
  return `${project.links.repo}/blob/main/${fact.source.file}`;
}

function FactLine({ project, fact }: { project: Project; fact: Fact }) {
  const href = sourceHref(project, fact);
  return (
    <li className="flex flex-col gap-1 border-l-2 border-[var(--accent)] pl-4">
      <span>{fact.text}</span>
      <span className="font-mono text-xs text-[var(--muted)]">
        {fact.kind === 'measured'
          ? 'measured'
          : fact.kind === 'parameter'
            ? 'design parameter'
            : 'design'}
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
  const found = withCaseStudy((await params).slug);
  if (!found) {
    notFound();
  }
  const { project, caseStudy } = found;
  const facts = new Map(project.facts.map((fact) => [fact.id, fact]));

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-14 px-4 py-10 sm:px-8 sm:py-14">
      <nav aria-label="Breadcrumb" className="font-mono text-sm text-[var(--muted)]">
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
        <p className="text-xl text-[var(--soft)]">{project.hook}</p>
        <ul
          aria-label="Built with"
          className="flex flex-wrap gap-2 font-mono text-xs text-[var(--muted)]"
        >
          {project.stack.map((tool) => (
            <li key={tool} className="rounded-full border border-[var(--line)] px-3 py-1">
              {tool}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-4">
          <a
            className="font-medium text-[var(--accent)] underline underline-offset-4"
            href={project.links.live}
          >
            Live
          </a>
          {project.links.repo ? (
            <a className="font-medium underline underline-offset-4" href={project.links.repo}>
              Code
            </a>
          ) : (
            <span className="text-sm text-[var(--muted)]">Source available on request</span>
          )}
        </div>
      </header>

      <section aria-labelledby="problem" className="flex flex-col gap-3">
        <h2
          id="problem"
          className="font-mono text-xs tracking-[0.12em] text-[var(--muted)] uppercase"
        >
          Why I built it
        </h2>
        <p className="max-w-[65ch] text-xl leading-relaxed">{caseStudy.problem}</p>
      </section>

      {caseStudy.demo && caseStudy.demoCaption && (
        <figure className="flex flex-col gap-3">
          <div className="relative h-[clamp(420px,62vh,620px)] overflow-hidden rounded-2xl border border-[var(--line)]">
            <ScenePlayer name={caseStudy.demo} description={caseStudy.demoCaption} />
          </div>
          <figcaption className="max-w-[65ch] text-sm text-[var(--muted)]">
            {caseStudy.demoCaption}
          </figcaption>
        </figure>
      )}

      <section aria-labelledby="decisions" className="flex flex-col gap-10">
        <h2
          id="decisions"
          className="font-mono text-xs tracking-[0.12em] text-[var(--muted)] uppercase"
        >
          Decisions
        </h2>
        {caseStudy.decisions.map((decision) => (
          <article key={decision.title} className="flex flex-col gap-4">
            <h3 className="text-2xl font-bold tracking-tight">{decision.title}</h3>
            <p className="max-w-[65ch] leading-relaxed">{decision.body}</p>
            {decision.facts.length > 0 && (
              <ul className="flex flex-col gap-3">
                {decision.facts.map((id) => {
                  const fact = facts.get(id);
                  return fact ? <FactLine key={id} project={project} fact={fact} /> : null;
                })}
              </ul>
            )}
          </article>
        ))}
      </section>

      <section aria-labelledby="proof" className="flex flex-col gap-3">
        <h2
          id="proof"
          className="font-mono text-xs tracking-[0.12em] text-[var(--muted)] uppercase"
        >
          How I know it works
        </h2>
        <p className="max-w-[65ch] leading-relaxed">{caseStudy.proof}</p>
      </section>

      <section aria-labelledby="next" className="flex flex-col gap-3">
        <h2 id="next" className="font-mono text-xs tracking-[0.12em] text-[var(--muted)] uppercase">
          What I would do next
        </h2>
        <p className="max-w-[65ch] leading-relaxed">{caseStudy.next}</p>
      </section>

      <footer className="border-t border-[var(--line)] pt-8 text-[var(--muted)]">
        <Link className="underline underline-offset-4" href="/">
          Back to everything I built
        </Link>
      </footer>
    </main>
  );
}
