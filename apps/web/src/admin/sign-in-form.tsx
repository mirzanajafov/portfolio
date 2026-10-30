'use client';

import { useActionState } from 'react';
import { signIn } from './actions';

export function SignInForm() {
  const [failure, action, pending] = useActionState<string | null>(signIn, null);
  return (
    <form action={action} className="flex flex-col items-start gap-4">
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-fg px-6 py-3 text-bg disabled:opacity-50"
      >
        Sign in
      </button>
      {failure && (
        <p role="alert" className="max-w-[65ch] text-muted">
          {failure}
        </p>
      )}
    </form>
  );
}
