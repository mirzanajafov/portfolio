import { join } from 'node:path';
import type { NextConfig } from 'next';

const workspaceRoot = join(import.meta.dirname, '../..');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: false,
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
