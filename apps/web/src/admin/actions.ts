'use server';

import { siteUrl } from '@portfolio/content';
import { refCode } from '@portfolio/content/analytics';
import { revalidatePath } from 'next/cache';
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
  type ApplicationEditBody,
  type ApplicationWrite,
  type NewApplicationBody,
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

const sharedFields = [
  'company',
  'role',
  'appliedOn',
  'channel',
  'cvVariant',
  'country',
  'city',
  'atsHost',
  'networks',
] as const;

const addFields = [...sharedFields, 'code'] as const;

const editFields = [...sharedFields, 'status', 'answeredOn', 'notes'] as const;

type FieldName = (typeof addFields)[number] | (typeof editFields)[number];

export type FormValues = Partial<Record<FieldName, string>>;

export type FormState = { failure: string; values: FormValues } | null;

const sessionEnded = 'The session has ended. Run admin link for a new sign-in link.';

const applicationGone =
  'The session has ended or the application is gone. Run admin link for a new sign-in link.';

function validCode(code: string): string {
  if (!refCode.test(code)) {
    notFound();
  }
  return code;
}

function cleaned(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.replaceAll('\r\n', '\n').trim() : '';
}

function textIn(form: FormData, name: FieldName): string {
  return cleaned(form.get(name));
}

function shownIn(form: FormData, name: FieldName): string {
  return cleaned(form.get(`shown.${name}`));
}

function linesIn(form: FormData, name: FieldName): string[] {
  return textIn(form, name)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function refused(failure: string, form: FormData, fields: readonly FieldName[]): FormState {
  return {
    failure,
    values: Object.fromEntries(fields.map((name) => [name, textIn(form, name)])),
  };
}

function newApplicationIn(form: FormData): NewApplicationBody {
  const given = (name: FieldName) => textIn(form, name) || undefined;
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

function editIn(form: FormData): ApplicationEditBody | null {
  const changed = (name: FieldName) => textIn(form, name) !== shownIn(form, name);
  if (!editFields.some(changed)) {
    return null;
  }
  const text = (name: FieldName) => (changed(name) ? textIn(form, name) : undefined);
  const hint = (name: FieldName) => (changed(name) ? textIn(form, name) || null : undefined);
  return {
    company: text('company'),
    role: text('role'),
    appliedOn: text('appliedOn'),
    channel: text('channel'),
    cvVariant: text('cvVariant'),
    status: text('status'),
    answeredOn: text('answeredOn'),
    notes: text('notes'),
    country: hint('country'),
    city: hint('city'),
    atsHost: hint('atsHost'),
    networks: changed('networks') ? linesIn(form, 'networks') : undefined,
  };
}

function failureOf(outcome: Exclude<ApplicationWrite, { kind: 'done' }>, missing: string): string {
  if (outcome.kind === 'missing') {
    return missing;
  }
  if (outcome.kind === 'limited') {
    return `Too many changes. Try again in ${inMinutes(outcome.retryAfterSeconds)}.`;
  }
  return outcome.message;
}

export async function addApplication(_state: FormState, form: FormData): Promise<FormState> {
  await headersFromSite();
  const token = await tokenIn(sessionCookie);
  if (token === undefined) {
    return refused(sessionEnded, form, addFields);
  }
  const outcome = await createApplication(apiUrl(), token, newApplicationIn(form));
  if (outcome.kind === 'done') {
    redirect(`/admin/applications/${outcome.application.code}`);
  }
  return refused(failureOf(outcome, sessionEnded), form, addFields);
}

export async function editApplication(
  code: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  await headersFromSite();
  const target = validCode(code);
  const token = await tokenIn(sessionCookie);
  if (token === undefined) {
    return refused(sessionEnded, form, editFields);
  }
  const edit = editIn(form);
  if (!edit) {
    return null;
  }
  const outcome = await updateApplication(apiUrl(), token, target, edit);
  if (outcome.kind === 'done') {
    revalidatePath(`/admin/applications/${target}`);
    return null;
  }
  return refused(failureOf(outcome, applicationGone), form, editFields);
}

export async function undoStatus(
  code: string,
  _failure: string | null,
  form: FormData,
): Promise<string | null> {
  await headersFromSite();
  const target = validCode(code);
  const token = await tokenIn(sessionCookie);
  if (token === undefined) {
    return sessionEnded;
  }
  const outcome = await undoStatusChange(apiUrl(), token, target, cleaned(form.get('from')));
  if (outcome.kind === 'done') {
    revalidatePath(`/admin/applications/${target}`);
    return null;
  }
  return failureOf(outcome, applicationGone);
}
