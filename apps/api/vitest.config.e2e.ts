import { config } from 'dotenv';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const { parsed } = config({ path: '.env.test', quiet: true, processEnv: {} });

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    env: { ...parsed, NODE_ENV: 'test' },
  },
});
