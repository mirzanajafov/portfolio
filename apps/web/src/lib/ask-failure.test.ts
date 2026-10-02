import { describe, expect, it } from 'vitest';
import { failureMessage } from './ask-failure';

describe('failureMessage', () => {
  it('tells a rate-limited visitor when to come back, rounded up to whole minutes', () => {
    expect(failureMessage(429, '420', 'me@example.com')).toBe(
      "That's a lot of questions in a short time. Try again in 7 minutes, or email me at me@example.com.",
    );
    expect(failureMessage(429, '5', 'me@example.com')).toMatch(/in 1 minute,/);
    expect(failureMessage(429, null, 'me@example.com')).toMatch(/in 1 minute,/);
  });

  it('explains a validation error and falls back to email for everything else', () => {
    expect(failureMessage(400, null, 'me@example.com')).toBe('Keep it under 300 characters.');
    expect(failureMessage(503, null, 'me@example.com')).toBe(
      "I can't answer right now. Email me at me@example.com instead.",
    );
  });
});
