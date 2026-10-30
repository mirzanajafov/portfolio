import { adminSessionSchema, adminSignInSchema } from '@portfolio/content/admin';
import { reportSchema, type Report } from '@portfolio/content/report';

type SessionStart =
  | { kind: 'signed in'; token: string; expiresAt: Date }
  | { kind: 'refused' }
  | { kind: 'limited'; retryAfterSeconds: number };

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

export async function isRegistered(
  apiUrl: string,
  token: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const response = await fetchImpl(`${apiUrl}/admin/applications/${code}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 404) {
    return false;
  }
  if (response.status !== 204) {
    throw unexpected('an application check', response);
  }
  return true;
}
