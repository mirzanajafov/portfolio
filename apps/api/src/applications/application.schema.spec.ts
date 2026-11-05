import { channels, statuses } from '@portfolio/content/applications';
import { describe, expect, it } from 'vitest';
import { ApplicationChannel, ApplicationStatus } from '../generated/prisma/client.js';

describe('the application schemas', () => {
  it('take exactly the channels and statuses the database stores, in its order', () => {
    expect(Object.values(ApplicationChannel)).toEqual(channels);
    expect(Object.values(ApplicationStatus)).toEqual(statuses);
  });
});
