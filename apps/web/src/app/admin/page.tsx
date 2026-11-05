import { reportSections } from '@portfolio/content/report-sections';
import { bakuTime } from '@portfolio/content/time';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { signOut } from '@/admin/actions';
import { fetchApplications, fetchReport, sessionExpiry } from '@/admin/api';
import { ApplicationList } from '@/admin/application-list';
import { sessionCookie, tokenIn } from '@/admin/cookies';
import { pill } from '@/admin/styles';
import { ReportView } from '@/admin/report-view';
import { apiUrl } from '@/lib/forward-to-api';

export const dynamic = 'force-dynamic';

const periods = [
  { days: 1, label: '1 day' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
];

type Query = Awaited<PageProps<'/admin'>['searchParams']>;

function viewOf({ days, all }: Query): { days: number | undefined; all: boolean } | null {
  if (days === undefined) {
    return { days: undefined, all: all === '1' };
  }
  const period = periods.find((choice) => String(choice.days) === days);
  return period ? { days: period.days, all: all === '1' } : null;
}

function hrefOf(days: number, all: boolean) {
  return { pathname: '/admin', query: all ? { days, all: 1 } : { days } };
}

export default async function AdminPage({ searchParams }: PageProps<'/admin'>) {
  const token = await tokenIn(sessionCookie);
  const view = viewOf(await searchParams);
  if (token === undefined || view === null) {
    notFound();
  }
  const [expiresAt, applications, report] = await Promise.all([
    sessionExpiry(apiUrl(), token),
    fetchApplications(apiUrl(), token),
    fetchReport(apiUrl(), token, view.days),
  ]);
  if (!expiresAt || !applications || !report) {
    notFound();
  }
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-16 sm:px-8">
      <header className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">Admin</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-muted">Signed in until {bakuTime(expiresAt)} Baku time.</p>
          <form action={signOut}>
            <button type="submit" className={pill}>
              Sign out
            </button>
          </form>
        </div>
        <nav aria-label="Report period" className="flex flex-wrap gap-2 text-sm">
          {periods.map(({ days, label }) => (
            <Link
              key={days}
              href={hrefOf(days, view.all)}
              prefetch={false}
              aria-current={days === report.period.days ? 'page' : undefined}
              className={`${pill} aria-[current=page]:border-fg`}
            >
              {label}
            </Link>
          ))}
          <Link href={hrefOf(report.period.days, !view.all)} prefetch={false} className={pill}>
            {view.all ? 'Cut long lists' : 'Show everything'}
          </Link>
        </nav>
      </header>
      <section className="flex flex-col gap-3 border-t border-line pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Applications</h2>
          <Link href="/admin/add" prefetch={false} className={pill}>
            Add an application
          </Link>
        </div>
        <ApplicationList applications={applications} />
      </section>
      <ReportView sections={reportSections(report, { all: view.all })} />
    </main>
  );
}
