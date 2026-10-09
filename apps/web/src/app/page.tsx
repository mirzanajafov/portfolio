import Link from 'next/link';
import { content, type Project } from '@portfolio/content';
import { Ask } from '@/components/ask';
import { ExperienceTimeline } from '@/components/experience';
import { SystemsTour, type TourStop } from '@/components/systems-tour';
import { headlineFact } from '@/lib/format';
import { personJsonLd, serializeJsonLd } from '@/lib/json-ld';

function toStop(project: Project): TourStop {
  const fact = headlineFact(project);
  return {
    id: project.slug,
    name: project.name,
    hook: project.hook,
    fact: { text: fact.text, kind: fact.kind },
    stack: project.stack,
    live: project.links.live,
    code: project.links.repo,
    caseStudy: project.caseStudy ? `/projects/${project.slug}` : undefined,
    privateSource: project.visibility === 'private',
  };
}

export default function Home() {
  const { profile, projects, cv } = content;
  const { links } = profile;
  const suggestions = projects.flatMap((project) =>
    project.evals.slice(0, 1).map((q) => q.question),
  );
  const [first, last] = profile.name.split(' ');

  return (
    <main className="flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(personJsonLd(profile, 'https://najafov.dev')),
        }}
      />

      <section aria-labelledby="intro" className="intro">
        <div className="intro-inner mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 sm:px-8">
          <p className="intro-eyebrow font-mono text-[13px] text-[var(--muted)]">
            {profile.location} · {profile.timezone} · {profile.availability}
          </p>
          <h1
            id="intro"
            className="text-[clamp(56px,11vw,168px)] leading-[0.86] font-extrabold tracking-[-0.045em]"
          >
            <span className="intro-word">
              <span style={{ ['--i' as string]: 0 }}>{first}</span>
            </span>{' '}
            <span className="intro-word">
              <span style={{ ['--i' as string]: 1 }}>{last}</span>
            </span>
          </h1>
          <p className="intro-role text-[clamp(20px,2.6vw,30px)] font-medium text-[var(--soft)]">
            {profile.headline}
          </p>
          <p className="intro-summary max-w-2xl text-lg leading-relaxed text-pretty">
            {profile.summary}
          </p>
          <nav aria-label="Contact" className="intro-actions flex flex-wrap gap-2">
            <a
              className="rounded-full bg-[var(--fg)] px-5 py-2.5 text-[var(--bg)]"
              href={`mailto:${links.email}`}
            >
              Email me
            </a>
            <Link
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5"
              href="/cv"
            >
              CV
            </Link>
            <a
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5"
              href={links.github}
            >
              GitHub
            </a>
            <a
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5"
              href={links.linkedin}
            >
              LinkedIn
            </a>
          </nav>
        </div>
        <p
          aria-hidden="true"
          className="intro-scroll font-mono text-xs whitespace-nowrap text-[var(--muted)]"
        >
          scroll to see what I built
        </p>
      </section>

      <SystemsTour
        intro={{
          title: 'Things I built',
          body: `${projects.length} apps, each with its own database, backups and a deploy script that rolls back, all on one server behind a shared proxy. Scroll and the camera moves from one to the next.`,
        }}
        stops={projects.map(toStop)}
        apps={projects.map((project) => ({
          id: project.slug,
          name: project.name,
          stack: project.stack,
        }))}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-4 py-24 sm:px-8">
        <div className="reveal">
          <Ask suggestions={suggestions} email={links.email} />
        </div>

        <section aria-labelledby="experience" className="reveal flex flex-col gap-8">
          <h2 id="experience" className="text-3xl font-bold tracking-tight">
            Where I worked
          </h2>
          <ExperienceTimeline roles={cv.experience} />
        </section>

        <footer className="flex flex-col gap-4 border-t border-[var(--line)] pt-8 text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            The fastest way to reach me is{' '}
            <a
              className="text-[var(--fg)] underline underline-offset-4"
              href={`mailto:${links.email}`}
            >
              {links.email}
            </a>
            .
          </p>
          <nav aria-label="Elsewhere" className="flex gap-5">
            <Link className="underline underline-offset-4 hover:text-[var(--fg)]" href="/cv">
              CV
            </Link>
            <a className="underline underline-offset-4 hover:text-[var(--fg)]" href={links.github}>
              GitHub
            </a>
            <a
              className="underline underline-offset-4 hover:text-[var(--fg)]"
              href={links.linkedin}
            >
              LinkedIn
            </a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
