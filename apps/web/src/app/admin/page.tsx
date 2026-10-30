import { notFound } from 'next/navigation';
import { signOut } from '@/admin/actions';
import { sessionCookie, tokenIn } from '@/admin/cookies';
import { sessionEnd } from '@/admin/sessions';
import { apiUrl } from '@/lib/forward-to-api';

const inBaku = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Baku',
});

export default async function AdminPage() {
  const token = await tokenIn(sessionCookie);
  const expiresAt = token === undefined ? null : await sessionEnd(apiUrl(), token);
  if (!expiresAt) {
    notFound();
  }
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-24 sm:px-8">
      <h1 className="text-4xl font-semibold tracking-tight">Admin</h1>
      <p className="max-w-[65ch] text-lg text-muted">
        Signed in until {inBaku.format(expiresAt)}, Baku time.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-full border border-line px-6 py-3 hover:border-accent"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
