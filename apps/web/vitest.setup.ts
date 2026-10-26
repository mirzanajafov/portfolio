import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

class InertObserver {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
}

Object.assign(window, {
  matchMedia: (media: string) => ({
    media,
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }),
  ResizeObserver: InertObserver,
  IntersectionObserver: InertObserver,
});

afterEach(() => {
  cleanup();
});
