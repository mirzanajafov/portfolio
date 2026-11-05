import type { NewApplication } from '../src/applications/application.schema.js';

export const anApplication = (overrides: Partial<NewApplication> = {}): NewApplication => ({
  company: 'Acme',
  role: 'Backend Engineer',
  appliedOn: new Date('2026-10-30'),
  channel: 'direct',
  cvVariant: 'base',
  networks: [],
  ...overrides,
});
