'use server';

import { siteUrl } from '@portfolio/content';
import { refCode } from '@portfolio/content/analytics';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { apiUrl } from '@/lib/forward-to-api';
import { linkCookie, sessionCookie, tokenIn } from './cookies';
import {
  createApplication,
  endSession,
  startSession,
  undoStatusChange,
  updateApplication,
  applicationFieldNames,
  type ApplicationFieldName,
  type ApplicationFields,
  type ApplicationWrite,
} from './api';

async function headersFromSite(): Promise<Headers> {
  const incoming = await headers();
  if (incoming.get('origin') !== (process.env.SITE_ORIGIN ?? new URL(siteUrl).origin)) {
    notFound();
  }
  return incoming;
}

function inMinutes(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? 'a minute' : `${String(minutes)} minutes`;
}

export async function signIn(): Promise<string> {
  const incoming = await headersFromSite();
  const link = await tokenIn(linkCookie);
  const outcome =
    link === undefined ? null : await startSession(apiUrl(), link, incoming.get('x-forwarded-for'));
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
  await headersFromSite();
  const token = await tokenIn(sessionCookie);
  if (token) {
    await endSession(apiUrl(), token);
  }
  (await cookies()).delete(sessionCookie);
  redirect('/admin');
}

export type FormValues = Partial<Record<ApplicationFieldName, string>>;

export type FormState = { failure: string; values: FormValues } | null;

const sessionEnded = 'The session has ended. Run admin link for a new sign-in link.';

function registered(code: string): string {
  if (!refCode.test(code)) {
    notFound();
  }
  return code;
}

function textIn(form: FormData, name: ApplicationFieldName): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function valuesOf(form: FormData): FormValues {
  return Object.fromEntries(applicationFieldNames.map((name) => [name, textIn(form, name)]));
}

function linesIn(form: FormData, name: ApplicationFieldName): string[] {
  return textIn(form, name)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function newApplicationIn(form: FormData): ApplicationFields {
  const given = (name: ApplicationFieldName) => textIn(form, name) || undefined;
  return {
    company: textIn(form, 'company'),
    role: textIn(form, 'role'),
    appliedOn: textIn(form, 'appliedOn'),
    channel: textIn(form, 'channel'),
    cvVariant: textIn(form, 'cvVariant'),
    code: given('code'),
    country: given('country'),
    city: given('city'),
    atsHost: given('atsHost'),
    networks: linesIn(form, 'networks'),
  };
}

function editIn(form: FormData): ApplicationFields {
  const orNull = (name: ApplicationFieldName) => textIn(form, name) || null;
  return {
    company: textIn(form, 'company'),
    role: textIn(form, 'role'),
    appliedOn: textIn(form, 'appliedOn'),
    channel: textIn(form, 'channel'),
    cvVariant: textIn(form, 'cvVariant'),
    status: textIn(form, 'status'),
    answeredOn: textIn(form, 'answeredOn') || undefined,
    notes: textIn(form, 'notes'),
    country: orNull('country'),
    city: orNull('city'),
    atsHost: orNull('atsHost'),
    networks: linesIn(form, 'networks'),
  };
}

function failureOf(outcome: ApplicationWrite): string {
  if (outcome.kind === 'done') {
    redirect(`/admin/applications/${outcome.application.code}`);
  }
  if (outcome.kind === 'missing') {
    return 'The session has ended or the application is gone. Run admin link for a new sign-in link.';
  }
  if (outcome.kind === 'limited') {
    return `Too many changes. Try again in ${inMinutes(outcome.retryAfterSeconds)}.`;
  }
  return outcome.message;
}

export async function addApplication(_state: FormState, form: FormData): Promise<FormState> {
  await headersFromSite();
  const token = await tokenIn(sessionCookie);
  const failure =
    token === undefined
      ? sessionEnded
      : failureOf(await createApplication(apiUrl(), token, newApplicationIn(form)));
  return { failure, values: valuesOf(form) };
}

export async function editApplication(
  code: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  await headersFromSite();
  const token = await tokenIn(sessionCookie);
  const failure =
    token === undefined
      ? sessionEnded
      : failureOf(await updateApplication(apiUrl(), token, registered(code), editIn(form)));
  return { failure, values: valuesOf(form) };
}

export async function undoStatus(code: string): Promise<string> {
  await headersFromSite();
  const token = await tokenIn(sessionCookie);
  if (token === undefined) {
    return sessionEnded;
  }
  return failureOf(await undoStatusChange(apiUrl(), token, registered(code)));
}
