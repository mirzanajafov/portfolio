import { join } from 'node:path';
import type { NextConfig } from 'next';

const workspaceRoot = join(import.meta.dirname, '../..');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: false,
  serverExternalPackages: ['pdfkit'],
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  async headers() {
    return [
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
