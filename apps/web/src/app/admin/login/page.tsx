import { notFound } from 'next/navigation';
import { linkCookie, tokenIn } from '@/admin/cookies';
import { SignInForm } from '@/admin/sign-in-form';

export default async function SignInPage() {
  if (!(await tokenIn(linkCookie))) {
    notFound();
  }
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-24 sm:px-8">
      <h1 className="text-4xl font-semibold tracking-tight">Sign in</h1>
      <p className="max-w-[65ch] text-lg text-muted">
        The link works once. The session it starts lasts 30 days in this browser.
      </p>
      <SignInForm />
    </main>
  );
}
