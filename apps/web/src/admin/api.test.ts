import { aReport } from '@portfolio/content/testing';
import { describe, expect, it, vi } from 'vitest';
import { endSession, fetchReport, isRegistered, sessionExpiry, startSession } from './api';

const api = 'http://api:3201';
const link = 'l'.repeat(43);
const session = 's'.repeat(43);

const answering = (status: number, body?: object, headers: Record<string, string> = {}) =>
  vi.fn<typeof fetch>(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...headers },
      }),
  );

describe('startSession', () => {
  it('sends the link with the caller address and returns the session and when it ends', async () => {
    const fetchImpl = answering(201, { token: session, expiresAt: '2026-11-29T12:00:00.000Z' });
    expect(await startSession(api, link, '203.0.113.7', fetchImpl)).toEqual({
      kind: 'signed in',
      token: session,
      expiresAt: new Date('2026-11-29T12:00:00Z'),
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api:3201/admin/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
        body: JSON.stringify({ token: link }),
      }),
    );
  });

  it('reads a 404 as a link that was refused and a 429 as the time to wait', async () => {
    expect(await startSession(api, link, null, answering(404))).toEqual({ kind: 'refused' });
    expect(
      await startSession(api, link, null, answering(429, {}, { 'retry-after': '420' })),
    ).toEqual({
      kind: 'limited',
      retryAfterSeconds: 420,
    });
  });

  it('fails on any other answer and on a session it cannot read', async () => {
    await expect(startSession(api, link, null, answering(500))).rejects.toThrow(
      'the API answered 500 to a sign-in',
    );
    await expect(
      startSession(api, link, null, answering(201, { token: 'short' })),
    ).rejects.toThrow();
  });
});

describe('sessionExpiry', () => {
  it('asks with the session as a bearer and returns when it ends', async () => {
    const fetchImpl = answering(200, { expiresAt: '2026-11-29T12:00:00.000Z' });
    expect(await sessionExpiry(api, session, fetchImpl)).toEqual(new Date('2026-11-29T12:00:00Z'));
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api:3201/admin/session',
      expect.objectContaining({ headers: { authorization: `Bearer ${session}` } }),
    );
  });

  it('reads a 404 as no session, and fails on anything else, so an outage is not a lost session', async () => {
    expect(await sessionExpiry(api, session, answering(404))).toBeNull();
    await expect(sessionExpiry(api, session, answering(502))).rejects.toThrow(
      'the API answered 502 to a session check',
    );
    const unreachable = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(sessionExpiry(api, session, unreachable)).rejects.toThrow('fetch failed');
  });
});

describe('endSession', () => {
  it('deletes the session, and takes a session that is already gone as ended', async () => {
    const fetchImpl = answering(204);
    await endSession(api, session, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api:3201/admin/session',
      expect.objectContaining({
        method: 'DELETE',
        headers: { authorization: `Bearer ${session}` },
      }),
    );
    await expect(endSession(api, session, answering(404))).resolves.toBeUndefined();
    await expect(endSession(api, session, answering(500))).rejects.toThrow(
      'the API answered 500 to a sign-out',
    );
  });
});

describe('fetchReport', () => {
  it('asks for the days with the session as a bearer and reads the dates back as dates', async () => {
    const report = aReport();
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(report), { status: 200 }),
    );

    expect(await fetchReport(api, session, 30, fetchImpl)).toEqual(report);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api:3201/admin/report?days=30',
      expect.objectContaining({ headers: { authorization: `Bearer ${session}` } }),
    );
  });

  it('leaves the days to the API when none are given', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(aReport()), { status: 200 }),
    );

    await fetchReport(api, session, undefined, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith('http://api:3201/admin/report', expect.anything());
  });

  it('reads a 404 as no session, and fails on anything else or on a report it cannot read', async () => {
    expect(await fetchReport(api, session, 7, answering(404))).toBeNull();
    await expect(fetchReport(api, session, 7, answering(500))).rejects.toThrow(
      'the API answered 500 to a report',
    );
    await expect(fetchReport(api, session, 7, answering(200, { period: {} }))).rejects.toThrow();
  });
});

describe('isRegistered', () => {
  it('asks for the code with the session as a bearer, and reads 204 as yes and 404 as no', async () => {
    const fetchImpl = answering(204);
    expect(await isRegistered(api, session, 'memh', fetchImpl)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api:3201/admin/applications/memh',
      expect.objectContaining({ headers: { authorization: `Bearer ${session}` } }),
    );
    expect(await isRegistered(api, session, 'memh', answering(404))).toBe(false);
  });

  it('fails on any other answer', async () => {
    await expect(isRegistered(api, session, 'memh', answering(500))).rejects.toThrow(
      'the API answered 500 to an application check',
    );
  });
});
