import Link from 'next/link';

export default function NotFound() {
  return (
    <main data-not-found className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-24 sm:px-8">
      <h1 className="text-4xl font-semibold tracking-tight">This page isn&apos;t here</h1>
      <p className="max-w-[65ch] text-lg text-muted">
        The link may be old, or the address has a typo.
      </p>
      <Link className="underline underline-offset-4" href="/">
        Back to everything I built
      </Link>
    </main>
  );
}
