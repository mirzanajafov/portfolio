import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/events', () => {
  it('fails loudly instead of guessing an API address when API_URL is missing', () => {
    vi.stubEnv('API_URL', undefined);
    const request = new Request('http://site/api/events', { method: 'POST', body: '{}' });
    expect(() => POST(request)).toThrow(/API_URL is not set/);
  });
});
