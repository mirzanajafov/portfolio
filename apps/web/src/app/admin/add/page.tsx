import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sessionExpiry } from '@/admin/api';
import { AddApplicationForm } from '@/admin/application-forms';
import { sessionCookie, tokenIn } from '@/admin/cookies';
import { apiUrl } from '@/lib/forward-to-api';

export const dynamic = 'force-dynamic';

export default async function AddApplicationPage() {
  const token = await tokenIn(sessionCookie);
  if (token === undefined || !(await sessionExpiry(apiUrl(), token))) {
    notFound();
  }
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16 sm:px-8">
      <Link href="/admin" prefetch={false} className="text-sm underline underline-offset-4">
        Back to admin
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight">Add an application</h1>
      <p className="max-w-[65ch] text-muted">
        It gets a code its links carry, and its page has the CV with that code once it is added.
      </p>
      <AddApplicationForm />
    </main>
  );
}
