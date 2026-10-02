import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { content } from '@portfolio/content';
import './globals.css';

const { profile } = content;

export const metadata: Metadata = {
  metadataBase: new URL('https://najafov.dev'),
  title: `${profile.name} · ${profile.headline}`,
  description: profile.summary,
  authors: [{ name: profile.name }],
  openGraph: {
    type: 'profile',
    title: `${profile.name} · ${profile.headline}`,
    description: profile.summary,
    url: '/',
  },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0a09' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
