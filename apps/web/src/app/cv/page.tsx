import type { Metadata } from 'next';
import { content } from '@portfolio/content';
import { RoleHeading } from '@/components/experience';
import { roleKey } from '@/lib/format';

const { profile, cv } = content;

export const metadata: Metadata = {
  title: `CV · ${profile.name}`,
  description: `${profile.headline}. ${profile.availability}.`,
};

function Roles({ title, roles }: { title: string; roles: typeof cv.experience }) {
  if (roles.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-6">
      <h2 className="border-b border-[var(--line)] pb-2 text-sm font-semibold uppercase tracking-widest">
        {title}
      </h2>
      {roles.map((role) => (
        <article key={roleKey(role)} className="flex flex-col gap-2 break-inside-avoid">
          <RoleHeading role={role} />
          {role.about && <p className="italic text-[var(--muted)]">{role.about}</p>}
          <ul className="list-disc pl-5 leading-relaxed">
            {role.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}

export default function CvPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-16 sm:px-8 print:py-0">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">{profile.name}</h1>
        <p className="text-xl text-[var(--accent)]">{profile.headline}</p>
        <p className="text-[var(--muted)]">
          {profile.location} ({profile.timezone}) · {profile.availability}
        </p>
        <p className="flex flex-wrap gap-x-4 text-sm">
          <a className="underline underline-offset-4" href={`mailto:${profile.links.email}`}>
            {profile.links.email}
          </a>
          <a className="underline underline-offset-4" href={profile.links.github}>
            {profile.links.github.replace('https://', '')}
          </a>
          <a className="underline underline-offset-4" href={profile.links.linkedin}>
            {profile.links.linkedin.replace('https://www.', '')}
          </a>
        </p>
        <p className="print:hidden">
          <a
            className="inline-flex rounded-full bg-[var(--fg)] px-5 py-2.5 text-sm text-[var(--bg)]"
            href="/cv.pdf"
          >
            Download as PDF
          </a>
        </p>
      </header>
      <Roles title="Experience" roles={cv.experience} />
      <Roles title="Mentoring" roles={cv.mentoring} />
      <section className="flex flex-col gap-3">
        <h2 className="border-b border-[var(--line)] pb-2 text-sm font-semibold uppercase tracking-widest">
          Skills
        </h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
          {cv.skills.map((skill) => (
            <div key={skill.group} className="contents">
              <dt className="font-medium">{skill.group}</dt>
              <dd className="text-[var(--muted)]">{skill.items.join(', ')}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="border-b border-[var(--line)] pb-2 text-sm font-semibold uppercase tracking-widest">
          Languages
        </h2>
        <p>
          {cv.languages
            .map((language) => `${language.name} (${language.level.toLowerCase()})`)
            .join(', ')}
        </p>
      </section>
    </main>
  );
}
