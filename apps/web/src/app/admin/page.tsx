import { defaultReportDays } from '@portfolio/content/report';
import { reportSections } from '@portfolio/content/report-sections';
import { bakuTime } from '@portfolio/content/time';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { signOut } from '@/admin/actions';
import { fetchReport, sessionExpiry } from '@/admin/api';
import { sessionCookie, tokenIn } from '@/admin/cookies';
import { ReportView } from '@/admin/report-view';
import { apiUrl } from '@/lib/forward-to-api';

export const dynamic = 'force-dynamic';

const periods = [
  { days: 1, label: '1 day' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
];

type Query = Awaited<PageProps<'/admin'>['searchParams']>;

function viewOf({ days = String(defaultReportDays), all }: Query) {
  const period = periods.find((choice) => String(choice.days) === days);
  return period ? { days: period.days, all: all === '1' } : null;
}

function hrefOf(days: number, all: boolean) {
  return { pathname: '/admin', query: all ? { days, all: 1 } : { days } };
}

const pill = 'rounded-full border border-line px-4 py-2 hover:border-accent';

export default async function AdminPage({ searchParams }: PageProps<'/admin'>) {
  const token = await tokenIn(sessionCookie);
  const view = viewOf(await searchParams);
  if (token === undefined || view === null) {
    notFound();
  }
  const [expiresAt, report] = await Promise.all([
    sessionExpiry(apiUrl(), token),
    fetchReport(apiUrl(), token, view.days),
  ]);
  if (!expiresAt || !report) {
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
              aria-current={days === view.days ? 'page' : undefined}
              className={`${pill} aria-[current=page]:border-fg`}
            >
              {label}
            </Link>
          ))}
          <Link href={hrefOf(view.days, !view.all)} prefetch={false} className={pill}>
            {view.all ? 'Cut long lists' : 'Show everything'}
          </Link>
        </nav>
      </header>
      <ReportView sections={reportSections(report, { all: view.all })} />
    </main>
  );
}
