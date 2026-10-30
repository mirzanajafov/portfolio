'use client';

import {
  errorMessageMaxLength,
  type VisitEvent,
  type WebVital,
} from '@portfolio/content/analytics';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { useCallback, useEffect, useRef } from 'react';
import { Reading } from './reading';

const maxErrors = 5;

type PageView = { id: string; reading: Reading; seq: number; errors: number };

function send(event: VisitEvent): void {
  const body = new Blob([JSON.stringify(event)], { type: 'application/json' });
  navigator.sendBeacon('/api/events', body);
}

function scrollDepth(): number {
  return ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100;
}

function referrerHost(): string | undefined {
  if (!document.referrer) {
    return undefined;
  }
  const { hostname } = new URL(document.referrer);
  return hostname === location.hostname ? undefined : hostname;
}

function begin(landing: boolean): PageView {
  const view = {
    id: crypto.randomUUID(),
    reading: new Reading(() => performance.now()),
    seq: 0,
    errors: 0,
  };
  view.reading.scrolled(scrollDepth());
  send({
    type: 'view',
    id: view.id,
    path: location.pathname,
    referrer: landing ? referrerHost() : undefined,
    ref: new URLSearchParams(location.search).get('r') ?? undefined,
    notFound: document.querySelector('[data-not-found]') !== null,
  });
  return view;
}

function flush(view: PageView): void {
  view.seq += 1;
  send({ type: 'read', view: view.id, seq: view.seq, ...view.reading.snapshot() });
}

function outbound(href: string): boolean {
  return href === '/cv.pdf' || new URL(href, location.href).origin !== location.origin;
}

function sourceOf(file: string): string {
  if (!file) {
    return location.pathname;
  }
  const url = new URL(file, location.href);
  return url.origin === location.origin ? url.pathname : 'external';
}

function isVital(name: string): name is WebVital {
  return name === 'LCP' || name === 'INP' || name === 'CLS';
}

export function VisitTracker() {
  const pathname = usePathname();
  const current = useRef<PageView | null>(null);
  const landing = useRef<string | null>(null);

  const reportVital = useCallback(({ name, value }: { name: string; value: number }) => {
    if (landing.current && isVital(name)) {
      send({ type: 'vital', view: landing.current, name, value });
    }
  }, []);
  useReportWebVitals(reportVital);

  useEffect(() => {
    current.current = begin(landing.current === null);
    landing.current ??= current.current.id;
    const observer = new IntersectionObserver(
      (entries) => {
        const view = current.current;
        for (const entry of entries) {
          const block = entry.target.getAttribute('data-read');
          if (!view || !block) {
            continue;
          }
          if (entry.isIntersecting) {
            view.reading.enter(block);
          } else {
            view.reading.leave(block);
            if (view.reading.newlyRead()) {
              flush(view);
            }
          }
        }
      },
      { rootMargin: '-25% 0px -25% 0px' },
    );
    for (const element of document.querySelectorAll('[data-read]')) {
      observer.observe(element);
    }
    return () => {
      observer.disconnect();
      if (current.current) {
        flush(current.current);
      }
    };
  }, [pathname]);

  useEffect(() => {
    const onInput = () => current.current?.reading.input();
    const onScroll = () => {
      current.current?.reading.input();
      current.current?.reading.scrolled(scrollDepth());
    };
    const onVisibility = () => {
      const view = current.current;
      const visible = document.visibilityState === 'visible';
      view?.reading.setVisible(visible);
      if (view && !visible) {
        flush(view);
      }
    };
    const onPageHide = () => {
      if (current.current) {
        flush(current.current);
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        current.current = begin(false);
      }
    };
    const onClick = (event: MouseEvent) => {
      const view = current.current;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      const href = link?.getAttribute('href');
      if (view && href && event.button !== 2 && outbound(href)) {
        send({ type: 'click', view: view.id, href });
      }
    };
    const report = (message: string, file: string, line?: number, column?: number) => {
      const view = current.current;
      if (!view || view.errors >= maxErrors) {
        return;
      }
      view.errors += 1;
      send({
        type: 'error',
        view: view.id,
        message: message.slice(0, errorMessageMaxLength),
        source: sourceOf(file),
        line,
        column,
      });
    };
    const onError = (event: ErrorEvent) => {
      report(event.message, event.filename, event.lineno, event.colno);
    };
    const onRejection = ({ reason }: PromiseRejectionEvent) => {
      report(reason instanceof Error ? reason.message : String(reason), '');
    };

    const inputs = ['pointerdown', 'keydown', 'touchstart'] as const;
    for (const name of inputs) {
      window.addEventListener(name, onInput, { passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onClick, true);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      for (const name of inputs) {
        window.removeEventListener(name, onInput);
      }
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('auxclick', onClick, true);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
