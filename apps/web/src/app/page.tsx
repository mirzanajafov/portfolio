import { content } from '@portfolio/content';
import { Ask } from '@/components/ask';
import { ExperienceTimeline } from '@/components/experience';
import { ProjectCard } from '@/components/project-card';
import { ScenePlayer } from '@/components/scene-player';
import { personJsonLd, serializeJsonLd } from '@/lib/json-ld';

export default function Home() {
  const { profile, projects, cv } = content;
  const { links } = profile;
  const suggestions = projects.flatMap((project) =>
    project.evals.slice(0, 1).map((q) => q.question),
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-20 px-4 py-6 sm:px-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(personJsonLd(profile, 'https://najafov.dev')),
        }}
      />
      <section aria-labelledby="intro" className="hero">
        <ScenePlayer
          name="systems"
          showLegend
          description="A live graph of what I run on my server: the browser, the edge proxy, Next.js, NestJS, the databases, MQTT and the ESP32 receivers, with requests moving between them."
        />
        <div className="hero-copy">
          <h1
            id="intro"
            className="text-[clamp(44px,7.4vw,96px)] leading-[0.92] font-extrabold tracking-[-0.035em]"
          >
            {profile.name}
          </h1>
          <p className="text-[clamp(18px,2.2vw,24px)] font-medium text-[var(--accent)]">
            {profile.headline}
          </p>
          <p className="font-mono text-[13px] text-[var(--muted)]">
            {profile.location} · {profile.timezone} · {profile.availability}
          </p>
          <nav aria-label="Contact" className="mt-2 flex flex-wrap gap-2">
            <a
              className="rounded-full bg-[var(--fg)] px-5 py-2.5 text-[var(--bg)]"
              href={`mailto:${links.email}`}
            >
              Email me
            </a>
            <a
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5"
              href="/cv"
            >
              CV
            </a>
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
      </section>

      <p className="max-w-3xl text-xl leading-relaxed text-pretty">{profile.summary}</p>

      <Ask suggestions={suggestions} email={links.email} />

      <section aria-labelledby="projects" className="flex flex-col gap-8">
        <h2 id="projects" className="text-3xl font-bold tracking-tight">
          Things I built
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
      </section>

      <section aria-labelledby="experience" className="flex flex-col gap-8">
        <h2 id="experience" className="text-3xl font-bold tracking-tight">
          Where I worked
        </h2>
        <ExperienceTimeline roles={cv.experience} />
      </section>

      <footer className="flex flex-col gap-2 border-t border-[var(--line)] pt-8 pb-10 text-[var(--muted)]">
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
      </footer>
    </main>
  );
}
