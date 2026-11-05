'use client';

import { useActionState } from 'react';
import { signIn } from './actions';
import { Failure } from './failure';
import { submit } from './styles';

export function SignInForm() {
  const [failure, action, pending] = useActionState<string | null>(signIn, null);
  return (
    <form action={action} className="flex flex-col items-start gap-4">
      <button type="submit" disabled={pending} className={submit}>
        Sign in
      </button>
      <Failure failure={failure} />
    </form>
  );
}
