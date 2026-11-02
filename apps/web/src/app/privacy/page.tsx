import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { content } from '@portfolio/content';
import {
  analyticsDays,
  backupDays,
  dailyTotalsMonths,
  demoSites,
  geolocationCredit,
} from '@portfolio/content/analytics';
import { askLogDays } from '@portfolio/content/ask';

const { profile } = content;

export const metadata: Metadata = {
  title: `What this site records · ${profile.name}`,
  description:
    'What najafov.dev and my demos record about visits and questions, for how long, and why.',
};

function Part({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-8 flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  const email = profile.links.email;
  const demos = [...demoSites(content).values()];
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
          a job application led to a visit. The recording uses no cookies and stores nothing in your
          browser.
        </p>
        <p className="max-w-[65ch]">
          When a page is shown, it sends me which page it is and the domain of the site that linked
          to it, how long the page and each of its parts were in front of you and how far down you
          read, which links to my repos, demos, CV, LinkedIn or email you clicked, how fast the page
          loaded and answered, and the message of any error in the site&apos;s own scripts. If the
          link you followed has a short code after <code className="whitespace-nowrap">?r=</code>, I
          put it there when I sent a job application, so a visit with a code most likely comes from
          that company.
        </p>
        <p className="max-w-[65ch]">
          From the request itself, the server works out the kind of device and browser, and the
          country, city and network owner of your IP address, using an offline database (
          <a className="underline underline-offset-4" href={geolocationCredit}>
            IP Geolocation by DB-IP
          </a>
          ). To tell that two pages were seen by the same visitor on the same day, it mixes your IP
          address (for IPv6, its network part) and your browser&apos;s User-Agent with a random
          value that is replaced at midnight UTC, and the old one is deleted within hours. Only the
          result is stored. Your IP address is never stored, and once that value is gone nobody, me
          included, can work out which address a record came from.
        </p>
        <p className="max-w-[65ch]">
          These records are deleted once their UTC day is {analyticsDays} full days old, so each
          lives {analyticsDays} to {analyticsDays + 1} days. What stays after that has no visitor in
          it. For each day I keep, for {dailyTotalsMonths} months, how long each visit lasted and
          how many were on a phone, how each page was read on each kind of device (views, seconds,
          scroll, the parts read, how fast it loaded, answered and held still), which missing pages
          were asked for, where visits came from, their countries and the links clicked. On a quiet
          day those totals may cover a single visit. Whether a link I sent with a job application
          was opened is kept as a daily count for as long as I track that application.
        </p>
        <p className="max-w-[65ch]">
          If your browser sends Global Privacy Control or Do Not Track, nothing is recorded, not
          even a count. Without JavaScript nothing is sent. Visits from known bots aren&apos;t
          recorded, only counted.
        </p>
      </Part>

      <Part title="Demos" id="demos">
        <p className="max-w-[65ch]">
          The demos below load a small script from this site that records a visit to them the same
          way: which part of the demo you opened (the first part of its address only) and the domain
          of the site that linked to it, how long it was in front of you, how far down you scrolled,
          and which of the demo&apos;s main steps you did. Nothing you type into a demo is sent.
        </p>
        <ul className="flex max-w-[65ch] list-disc flex-col gap-1 pl-5">
          {demos.map(({ slug, name, host, actions }) => (
            <li key={slug}>
              {name} ({host}): {Object.values(actions).join(', ')}
            </li>
          ))}
        </ul>
        <p className="max-w-[65ch]">
          A demo page opened on the same UTC day as a page of this site, from the same browser and
          network, counts as the same visit, through the same daily value as above. That is how I
          can see whether someone who read about a demo also tried it. If you came through a link I
          sent with a job application, the demos you opened that day are recorded as part of that
          application&apos;s visit. Everything above applies to the demos too: Global Privacy
          Control and Do Not Track record nothing, bots are only counted, and the records are
          deleted on the same schedule. The demos are separate apps with their own data, such as a
          Matchium account, and this page covers only what they send here.
        </p>
      </Part>

      <Part title="Questions you ask">
        <p className="max-w-[65ch]">
          I keep questions for {askLogDays} days to see where the answers fail, then they are
          deleted. A question is tied to the visit it was asked in by the same daily mix of address
          and User-Agent as above, so I can see what a visit wanted to know. With Global Privacy
          Control or Do Not Track on, a question is still answered and kept, but tied to no visit.
          Questions are rate limited by your network mixed with that same daily value, so the
          address itself is never stored.
        </p>
      </Part>

      <Part title="Backups">
        <p className="max-w-[65ch]">
          Every day, and before each update of the site, the server makes a backup of the records
          above, so that a mistake can&apos;t lose them. The daily random value and the rate limit
          counts are never in a backup. A backup is deleted by the first daily run after it turns{' '}
          {backupDays} days old, so a deleted record can stay in a backup for up to {backupDays + 1}{' '}
          more days. The backups stay on the same server.
        </p>
      </Part>

      <Part title="Why, and your rights">
        <p className="max-w-[65ch]">
          I rely on my legitimate interest in knowing whether the site and my demos work for the
          people they are for and whether my applications reach anyone (Article 6(1)(f) GDPR). You
          can object at any time: turning on Global Privacy Control or Do Not Track stops it for
          every later visit (a question you ask is still kept, tied to no visit), and if you email
          me the day and rough time of a visit, I&apos;ll find and delete what was recorded. You can
          ask what I have about you, and you can complain to a data protection authority. Nothing is
          sold or shared. This site loads no third-party scripts, and the demos load their recording
          script from this site.
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
