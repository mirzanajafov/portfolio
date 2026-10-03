import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.node.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.node.test.ts'],
        },
      },
    ],
  },
});
