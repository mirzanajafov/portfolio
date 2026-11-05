import {
  adminRefusalSchema,
  adminSessionSchema,
  adminSignInSchema,
} from '@portfolio/content/admin';
import {
  applicationListSchema,
  applicationPageSchema,
  applicationViewSchema,
  type ApplicationPage,
  type ApplicationView,
} from '@portfolio/content/applications';
import { reportSchema, type Report } from '@portfolio/content/report';

type SessionStart =
  | { kind: 'signed in'; token: string; expiresAt: Date }
  | { kind: 'refused' }
  | { kind: 'limited'; retryAfterSeconds: number };

export type ApplicationFields = Record<string, string | string[] | null>;

export type ApplicationWrite =
  | { kind: 'done'; application: ApplicationView }
  | { kind: 'refused'; message: string }
  | { kind: 'limited'; retryAfterSeconds: number }
  | { kind: 'missing' };

const timeoutMs = 5_000;
const reportTimeoutMs = 30_000;

function unexpected(what: string, { status }: Response): Error {
  return new Error(`the API answered ${String(status)} to ${what}`);
}

export async function startSession(
  apiUrl: string,
  link: string,
  forwardedFor: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<SessionStart> {
  const response = await fetchImpl(`${apiUrl}/admin/sessions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
    },
    body: JSON.stringify({ token: link }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 404) {
    return { kind: 'refused' };
  }
  if (response.status === 429) {
    return { kind: 'limited', retryAfterSeconds: Number(response.headers.get('retry-after')) };
  }
  if (response.status !== 201) {
    throw unexpected('a sign-in', response);
  }
  return { kind: 'signed in', ...adminSignInSchema.parse(await response.json()) };
}

export async function sessionExpiry(
  apiUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Date | null> {
  const response = await fetchImpl(`${apiUrl}/admin/session`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 404) {
    return null;
  }
  if (response.status !== 200) {
    throw unexpected('a session check', response);
  }
  return adminSessionSchema.parse(await response.json()).expiresAt;
}

export async function endSession(
  apiUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(`${apiUrl}/admin/session`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status !== 204 && response.status !== 404) {
    throw unexpected('a sign-out', response);
  }
}

export async function fetchReport(
  apiUrl: string,
  token: string,
  days: number | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<Report | null> {
  const query = days === undefined ? '' : `?days=${String(days)}`;
  const response = await fetchImpl(`${apiUrl}/admin/report${query}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(reportTimeoutMs),
  });
  if (response.status === 404) {
    return null;
  }
  if (response.status !== 200) {
    throw unexpected('a report', response);
  }
  return reportSchema.parse(await response.json());
}

export async function fetchApplications(
  apiUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApplicationView[] | null> {
  const response = await fetchImpl(`${apiUrl}/admin/applications`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 404) {
    return null;
  }
  if (response.status !== 200) {
    throw unexpected('a list of applications', response);
  }
  return applicationListSchema.parse(await response.json());
}

export async function fetchApplication(
  apiUrl: string,
  token: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApplicationPage | null> {
  const response = await fetchImpl(`${apiUrl}/admin/applications/${code}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 404) {
    return null;
  }
  if (response.status !== 200) {
    throw unexpected('an application', response);
  }
  return applicationPageSchema.parse(await response.json());
}

async function outcomeOf(what: string, response: Response): Promise<ApplicationWrite> {
  if (response.status === 200 || response.status === 201) {
    return { kind: 'done', application: applicationViewSchema.parse(await response.json()) };
  }
  if (response.status === 400 || response.status === 409) {
    return { kind: 'refused', message: adminRefusalSchema.parse(await response.json()).message };
  }
  if (response.status === 429) {
    return { kind: 'limited', retryAfterSeconds: Number(response.headers.get('retry-after')) };
  }
  if (response.status === 404) {
    return { kind: 'missing' };
  }
  throw unexpected(what, response);
}

function sending(method: 'POST' | 'PATCH', token: string, fields?: ApplicationFields): RequestInit {
  return {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: fields && JSON.stringify(fields),
    signal: AbortSignal.timeout(timeoutMs),
  };
}

export async function createApplication(
  apiUrl: string,
  token: string,
  fields: ApplicationFields,
  fetchImpl: typeof fetch = fetch,
): Promise<ApplicationWrite> {
  const response = await fetchImpl(`${apiUrl}/admin/applications`, sending('POST', token, fields));
  return outcomeOf('a new application', response);
}

export async function updateApplication(
  apiUrl: string,
  token: string,
  code: string,
  fields: ApplicationFields,
  fetchImpl: typeof fetch = fetch,
): Promise<ApplicationWrite> {
  const response = await fetchImpl(
    `${apiUrl}/admin/applications/${code}`,
    sending('PATCH', token, fields),
  );
  return outcomeOf('an edit', response);
}

export async function undoStatusChange(
  apiUrl: string,
  token: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApplicationWrite> {
  const response = await fetchImpl(
    `${apiUrl}/admin/applications/${code}/undo`,
    sending('POST', token),
  );
  return outcomeOf('an undo', response);
}
