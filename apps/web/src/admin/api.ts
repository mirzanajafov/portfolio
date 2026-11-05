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

export type NewApplicationBody = {
  company: string;
  role: string;
  appliedOn: string;
  channel: string;
  cvVariant: string;
  code?: string;
  country?: string;
  city?: string;
  atsHost?: string;
  networks: string[];
};

export type ApplicationEditBody = Partial<{
  company: string;
  role: string;
  appliedOn: string;
  channel: string;
  cvVariant: string;
  status: string;
  answeredOn: string;
  notes: string;
  country: string | null;
  city: string | null;
  atsHost: string | null;
  networks: string[];
}>;

export type ApplicationWrite =
  | { kind: 'done'; application: ApplicationView }
  | { kind: 'refused'; message: string }
  | { kind: 'limited'; retryAfterSeconds: number }
  | { kind: 'missing' };

const timeoutMs = 5_000;
const reportTimeoutMs = 30_000;

function retryAfterOf(response: Response): number {
  const seconds = Number(response.headers.get('retry-after'));
  return seconds > 0 ? seconds : 60;
}

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
    return { kind: 'limited', retryAfterSeconds: retryAfterOf(response) };
  }
  if (response.status !== 201) {
    throw unexpected('a sign-in', response);
  }
  return { kind: 'signed in', ...adminSignInSchema.parse(await response.json()) };
}

async function read<T>(
  url: string,
  token: string,
  what: string,
  schema: { parse: (value: unknown) => T },
  fetchImpl: typeof fetch,
  timeout = timeoutMs,
): Promise<T | null> {
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeout),
  });
  if (response.status === 404) {
    return null;
  }
  if (response.status !== 200) {
    throw unexpected(what, response);
  }
  return schema.parse(await response.json());
}

export async function sessionExpiry(
  apiUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Date | null> {
  const session = await read(
    `${apiUrl}/admin/session`,
    token,
    'a session check',
    adminSessionSchema,
    fetchImpl,
  );
  return session?.expiresAt ?? null;
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

export function fetchReport(
  apiUrl: string,
  token: string,
  days: number | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<Report | null> {
  const query = days === undefined ? '' : `?days=${String(days)}`;
  return read(
    `${apiUrl}/admin/report${query}`,
    token,
    'a report',
    reportSchema,
    fetchImpl,
    reportTimeoutMs,
  );
}

export function fetchApplications(
  apiUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApplicationView[] | null> {
  return read(
    `${apiUrl}/admin/applications`,
    token,
    'a list of applications',
    applicationListSchema,
    fetchImpl,
  );
}

export function fetchApplication(
  apiUrl: string,
  token: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApplicationPage | null> {
  return read(
    `${apiUrl}/admin/applications/${code}`,
    token,
    'an application',
    applicationPageSchema,
    fetchImpl,
  );
}

async function outcomeOf(what: string, response: Response): Promise<ApplicationWrite> {
  if (response.status === 200 || response.status === 201) {
    return { kind: 'done', application: applicationViewSchema.parse(await response.json()) };
  }
  if (response.status === 400 || response.status === 409) {
    return { kind: 'refused', message: adminRefusalSchema.parse(await response.json()).message };
  }
  if (response.status === 429) {
    return { kind: 'limited', retryAfterSeconds: retryAfterOf(response) };
  }
  if (response.status === 404) {
    return { kind: 'missing' };
  }
  throw unexpected(what, response);
}

function sending(
  method: 'POST' | 'PATCH',
  token: string,
  body: NewApplicationBody | ApplicationEditBody | { from: string },
): RequestInit {
  return {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  };
}

export async function createApplication(
  apiUrl: string,
  token: string,
  body: NewApplicationBody,
  fetchImpl: typeof fetch = fetch,
): Promise<ApplicationWrite> {
  const response = await fetchImpl(`${apiUrl}/admin/applications`, sending('POST', token, body));
  return outcomeOf('a new application', response);
}

export async function updateApplication(
  apiUrl: string,
  token: string,
  code: string,
  body: ApplicationEditBody,
  fetchImpl: typeof fetch = fetch,
): Promise<ApplicationWrite> {
  const response = await fetchImpl(
    `${apiUrl}/admin/applications/${code}`,
    sending('PATCH', token, body),
  );
  return outcomeOf('an edit', response);
}

export async function undoStatusChange(
  apiUrl: string,
  token: string,
  code: string,
  from: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApplicationWrite> {
  const response = await fetchImpl(
    `${apiUrl}/admin/applications/${code}/undo`,
    sending('POST', token, { from }),
  );
  return outcomeOf('an undo', response);
}
