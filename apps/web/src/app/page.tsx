import { content } from '@portfolio/content';
import { personJsonLd, serializeJsonLd } from '@/lib/json-ld';

export default function Home() {
  const { profile } = content;
  const { links } = profile;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-4 py-16 sm:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(personJsonLd(profile, 'https://najafov.dev')),
        }}
      />
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">{profile.name}</h1>
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
        <a className="rounded-full border border-current px-5 py-2.5" href={links.github}>
          GitHub
        </a>
        <a className="rounded-full border border-current px-5 py-2.5" href={links.linkedin}>
          LinkedIn
        </a>
      </nav>
    </main>
  );
}
