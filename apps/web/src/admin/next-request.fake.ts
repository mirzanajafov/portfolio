import { vi } from 'vitest';

export const request = {
  headers: new Headers(),
  cookies: new Map<string, string>(),
  set: vi.fn(),
  delete: vi.fn(),
};

export const nextHeaders = {
  headers: async () => request.headers,
  cookies: async () => ({
    get: (name: string) => {
      const value = request.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: request.set,
    delete: request.delete,
  }),
};

export const nextNavigation = {
  notFound: () => {
    throw new Error('not found');
  },
  redirect: (to: string) => {
    throw new Error(`redirect to ${to}`);
  },
};
