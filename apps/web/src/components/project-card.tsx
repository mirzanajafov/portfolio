import type { Project } from '@portfolio/content';
import { headlineFact } from '@/lib/format';

export function ProjectCard({ project }: { project: Project }) {
  const fact = headlineFact(project);
  const titleId = `project-${project.slug}`;

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-2xl border border-[var(--line)] p-6"
    >
      <header className="flex flex-col gap-1">
        <h3 id={titleId} className="text-2xl font-semibold tracking-tight">
          {project.name}
        </h3>
        <p className="text-[var(--muted)]">{project.hook}</p>
      </header>
      <p className="text-lg leading-snug">
        {fact.text}
        {fact.kind === 'parameter' && (
          <span className="ml-2 whitespace-nowrap rounded-full border border-[var(--line)] px-2 py-0.5 align-middle text-xs text-[var(--muted)]">
            design parameter
          </span>
        )}
      </p>
      <ul aria-label="Built with" className="flex flex-wrap gap-2 text-sm text-[var(--muted)]">
        {project.stack.map((tool) => (
          <li key={tool} className="rounded-full bg-[var(--surface)] px-3 py-1">
            {tool}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-2">
        <a
          className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
          href={project.links.live}
        >
          Live
        </a>
        {project.links.repo ? (
          <a className="font-medium underline-offset-4 hover:underline" href={project.links.repo}>
            Code
          </a>
        ) : (
          <span className="text-sm text-[var(--muted)]">Source available on request</span>
        )}
        {project.hasCaseStudy && (
          <a
            className="font-medium underline-offset-4 hover:underline"
            href={`/projects/${project.slug}`}
          >
            Case study
          </a>
        )}
      </div>
    </article>
  );
}
