import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Schibsted_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import { content } from '@portfolio/content';
import './globals.css';

const body = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const code = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-code',
  display: 'swap',
});

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
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0d11' },
    { media: '(prefers-color-scheme: light)', color: '#f3f5f7' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${code.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
