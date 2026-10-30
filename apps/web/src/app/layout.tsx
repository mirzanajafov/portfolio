import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Schibsted_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import { content, siteUrl } from '@portfolio/content';
import { VisitTracker } from '@/analytics/tracker';
import { palette } from '@/lib/palette';
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
  metadataBase: new URL(siteUrl),
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
    { media: '(prefers-color-scheme: dark)', color: palette.dark.bg },
    { media: '(prefers-color-scheme: light)', color: palette.light.bg },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${code.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <VisitTracker />
      </body>
    </html>
  );
}
