'use server';

import { siteUrl } from '@portfolio/content';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { apiUrl } from '@/lib/forward-to-api';
import { linkCookie, sessionCookie, tokenIn } from './cookies';
import { endSession, signIn as startSession } from './sessions';

async function refuseOtherOrigins(): Promise<void> {
  const origin = (await headers()).get('origin');
  if (origin !== (process.env.SITE_ORIGIN ?? new URL(siteUrl).origin)) {
    notFound();
  }
}

function inMinutes(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? 'a minute' : `${String(minutes)} minutes`;
}

export async function signIn(): Promise<string> {
  await refuseOtherOrigins();
  const link = await tokenIn(linkCookie);
  const outcome =
    link === undefined
      ? null
      : await startSession(apiUrl(), link, (await headers()).get('x-forwarded-for'));
  if (outcome?.kind === 'limited') {
    return `Too many sign-ins from this network. Try again in ${inMinutes(outcome.retryAfterSeconds)}.`;
  }
  if (outcome?.kind !== 'signed in') {
    return 'This link has expired or was already used. Run admin link for a new one.';
  }
  const jar = await cookies();
  jar.delete(linkCookie);
  jar.set({ ...sessionCookie, value: outcome.token, expires: outcome.expiresAt });
  redirect('/admin');
}

export async function signOut(): Promise<void> {
  await refuseOtherOrigins();
  const token = await tokenIn(sessionCookie);
  if (token) {
    await endSession(apiUrl(), token);
  }
  (await cookies()).delete(sessionCookie);
  redirect('/');
}
