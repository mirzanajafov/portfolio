import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { content } from '@portfolio/content';
import { analyticsDays } from '@portfolio/content/analytics';
import { askLogDays } from '@portfolio/content/ask';

const { profile } = content;

export const metadata: Metadata = {
  title: `What this site records · ${profile.name}`,
  description: 'What najafov.dev records about visits and questions, for how long, and why.',
};

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  const email = profile.links.email;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-16 leading-relaxed sm:px-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">What this site records</h1>
        <p className="max-w-[65ch]">
          This is my site, and I&apos;m the only person who sees what it records. If you have a
          question about any of it, email{' '}
          <a className="underline underline-offset-4" href={`mailto:${email}`}>
            {email}
          </a>
          .
        </p>
      </header>

      <Part title="Visits">
        <p className="max-w-[65ch]">
          I record how the site is used, to see what people read, what doesn&apos;t work and whether
          a job application led to a visit. There are no cookies, and nothing is stored in your
          browser.
        </p>
        <p className="max-w-[65ch]">
          When a page is shown, it sends me which page it is and the domain of the site that linked
          to it, how long the page was in front of you and how far down you read, which links to my
          repos, demos, CV, LinkedIn or email you clicked, how fast the page loaded and whether a
          script failed. If the link you followed has a short code after{' '}
          <code className="whitespace-nowrap">?r=</code>, I put it there when I sent a job
          application, so a visit with a code most likely comes from that company.
        </p>
        <p className="max-w-[65ch]">
          From the request itself, the server works out the kind of device and browser, and the
          country, city and network owner of your IP address, using an offline database (
          <a className="underline underline-offset-4" href="https://db-ip.com">
            IP Geolocation by DB-IP
          </a>
          ). To tell that two pages were seen by the same visitor on the same day, it mixes your IP
          address and browser version with a random value that is replaced at midnight UTC, and the
          old one is deleted within hours. Only the result is stored. Your IP address is never
          stored, and once that value is gone nobody, me included, can work out which address a
          record came from.
        </p>
        <p className="max-w-[65ch]">These records are deleted after {analyticsDays} days.</p>
        <p className="max-w-[65ch]">
          If your browser sends Global Privacy Control or Do Not Track, nothing is recorded, not
          even a count. Without JavaScript nothing is sent. Known bots aren&apos;t counted.
        </p>
      </Part>

      <Part title="Questions you ask">
        <p className="max-w-[65ch]">
          I keep questions for {askLogDays} days to see where the answers fail, then they are
          deleted. Your IP address is never stored, only a keyed hash that changes every day and is
          used for rate limiting.
        </p>
      </Part>

      <Part title="Why, and your rights">
        <p className="max-w-[65ch]">
          I rely on my legitimate interest in knowing whether the site works for the people it is
          for and whether my applications reach anyone (Article 6(1)(f) GDPR). You can object at any
          time: turning on Global Privacy Control or Do Not Track stops it for every later visit,
          and if you email me the day and rough time of a visit, I&apos;ll find and delete what was
          recorded. You can ask what I have about you, and you can complain to a data protection
          authority. Nothing is sold or shared, and the site loads no third-party scripts.
        </p>
      </Part>

      <footer className="border-t border-line pt-8 text-muted">
        <Link className="underline underline-offset-4" href="/">
          Back to everything I built
        </Link>
      </footer>
    </main>
  );
}
