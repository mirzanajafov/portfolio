import { refCode } from '@portfolio/content/analytics';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchApplication } from '@/admin/api';
import { EditApplicationForm, UndoForm } from '@/admin/application-forms';
import { sessionCookie, tokenIn } from '@/admin/cookies';
import { apiUrl } from '@/lib/forward-to-api';

export const dynamic = 'force-dynamic';

export default async function EditApplicationPage({
  params,
}: PageProps<'/admin/applications/[code]'>) {
  const { code } = await params;
  const token = await tokenIn(sessionCookie);
  if (token === undefined || !refCode.test(code)) {
    notFound();
  }
  const application = await fetchApplication(apiUrl(), token, code);
  if (!application) {
    notFound();
  }
  const opened = application.firstSeenOn ? `, link first opened ${application.firstSeenOn}` : '';
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16 sm:px-8">
      <Link href="/admin" prefetch={false} className="text-sm underline underline-offset-4">
        Back to admin
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight break-words">
          {application.company}, {application.role}
        </h1>
        <p className="text-muted">
          Code {code}, applied {application.appliedOn}, {application.status}
          {opened}
        </p>
        <a
          href={`/admin/applications/${code}/cv`}
          className="self-start text-sm underline underline-offset-4"
        >
          Download CV
        </a>
      </header>
      {application.undoTo && <UndoForm code={code} undoTo={application.undoTo} />}
      <EditApplicationForm key={JSON.stringify(application)} application={application} />
    </main>
  );
}
