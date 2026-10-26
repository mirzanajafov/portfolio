import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { content } from '@portfolio/content';
import { RoleHeading } from '@/components/experience';
import { languagesLine, linkText, roleKey } from '@/lib/format';

const { profile, cv } = content;

export const metadata: Metadata = {
  title: `CV · ${profile.name}`,
  description: `${profile.headline}. ${profile.availability}.`,
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="border-b border-line pb-2 text-sm font-semibold uppercase tracking-widest">
      {children}
    </h2>
  );
}

function Roles({ title, roles }: { title: string; roles: typeof cv.experience }) {
  if (roles.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-6">
      <SectionTitle>{title}</SectionTitle>
      {roles.map((role) => (
        <article key={roleKey(role)} className="flex flex-col gap-2 break-inside-avoid">
          <RoleHeading role={role} />
          {role.about && <p className="italic text-muted">{role.about}</p>}
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
        <p className="text-xl text-soft">{profile.headline}</p>
        <p className="text-muted">
          {profile.location} ({profile.timezone}) · {profile.availability}
        </p>
        <p className="flex flex-wrap gap-x-4 text-sm">
          <a className="underline underline-offset-4" href={`mailto:${profile.links.email}`}>
            {profile.links.email}
          </a>
          <a className="underline underline-offset-4" href={profile.links.github}>
            {linkText(profile.links.github)}
          </a>
          <a className="underline underline-offset-4" href={profile.links.linkedin}>
            {linkText(profile.links.linkedin)}
          </a>
        </p>
        <p className="print:hidden">
          <a className="inline-flex rounded-full bg-fg px-5 py-2.5 text-sm text-bg" href="/cv.pdf">
            Download as PDF
          </a>
        </p>
      </header>
      <Roles title="Experience" roles={cv.experience} />
      <Roles title="Mentoring" roles={cv.mentoring} />
      <section className="flex flex-col gap-3">
        <SectionTitle>Skills</SectionTitle>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
          {cv.skills.map((skill) => (
            <div key={skill.group} className="contents">
              <dt className="font-medium">{skill.group}</dt>
              <dd className="text-muted">{skill.items.join(', ')}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="flex flex-col gap-3">
        <SectionTitle>Languages</SectionTitle>
        <p>{languagesLine(cv.languages)}</p>
      </section>
    </main>
  );
}
