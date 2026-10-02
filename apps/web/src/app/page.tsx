import { content } from '@portfolio/content';
import { Ask } from '@/components/ask';
import { ExperienceTimeline } from '@/components/experience';
import { ProjectCard } from '@/components/project-card';
import { personJsonLd, serializeJsonLd } from '@/lib/json-ld';

export default function Home() {
  const { profile, projects, cv } = content;
  const { links } = profile;
  const suggestions = projects.flatMap((project) =>
    project.evals.slice(0, 1).map((q) => q.question),
  );

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-24 px-4 py-16 sm:px-8 sm:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(personJsonLd(profile, 'https://najafov.dev')),
        }}
      />
      <section aria-labelledby="intro" className="flex min-h-[70dvh] flex-col justify-center gap-8">
        <header className="flex flex-col gap-3">
          <h1 id="intro" className="text-4xl font-semibold tracking-tight sm:text-6xl">
            {profile.name}
          </h1>
          <p className="text-xl text-[var(--accent)] sm:text-2xl">{profile.headline}</p>
          <p className="text-[var(--muted)]">
            {profile.location} ({profile.timezone}) · {profile.availability}
          </p>
        </header>
        <p className="max-w-2xl text-lg leading-relaxed">{profile.summary}</p>
        <nav aria-label="Contact" className="flex flex-wrap gap-3">
          <a
            className="rounded-full bg-[var(--foreground)] px-5 py-2.5 text-[var(--background)]"
            href={`mailto:${links.email}`}
          >
            Email me
          </a>
          <a className="rounded-full border border-current px-5 py-2.5" href="/cv">
            CV
          </a>
          <a className="rounded-full border border-current px-5 py-2.5" href={links.github}>
            GitHub
          </a>
          <a className="rounded-full border border-current px-5 py-2.5" href={links.linkedin}>
            LinkedIn
          </a>
        </nav>
      </section>

      <Ask suggestions={suggestions} email={links.email} />

      <section aria-labelledby="projects" className="flex flex-col gap-8">
        <h2 id="projects" className="text-3xl font-semibold tracking-tight">
          Things I built
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
      </section>

      <section aria-labelledby="experience" className="flex flex-col gap-8">
        <h2 id="experience" className="text-3xl font-semibold tracking-tight">
          Where I worked
        </h2>
        <ExperienceTimeline roles={cv.experience} />
      </section>

      <footer className="flex flex-col gap-2 border-t border-[var(--line)] pt-8 text-[var(--muted)]">
        <p>
          The fastest way to reach me is{' '}
          <a
            className="text-[var(--foreground)] underline underline-offset-4"
            href={`mailto:${links.email}`}
          >
            {links.email}
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
