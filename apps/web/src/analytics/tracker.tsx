'use client';

import {
  errorMessageMaxLength,
  maxPathLength,
  webVitals,
  type VisitEvent,
  type WebVital,
} from '@portfolio/content/analytics';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { Component, useCallback, useEffect, useRef, type ReactNode } from 'react';
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

function pathOf(path: string): string {
  return path
    .replace(/^\/+/, '/')
    .replace(/[[\]^|]/g, encodeURIComponent)
    .slice(0, maxPathLength)
    .replace(/%[0-9A-F]?$/i, '');
}

function begin(withReferrer: boolean, lastInput: number | undefined): PageView {
  const view = {
    id: crypto.randomUUID(),
    reading: new Reading(() => performance.now(), lastInput),
    seq: 0,
    errors: 0,
  };
  view.reading.scrolled(scrollDepth());
  send({
    type: 'view',
    id: view.id,
    path: pathOf(location.pathname),
    referrer: withReferrer ? referrerHost() : undefined,
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

function ownScript(file: string): string | undefined {
  if (!file) {
    return undefined;
  }
  const url = new URL(file, location.href);
  return url.origin === location.origin ? pathOf(url.pathname) : undefined;
}

function ownFrame(stack: string | undefined): string | undefined {
  for (const [, file = ''] of stack?.matchAll(/(https?:\/\/[^\s()@]+?):\d+:\d+/g) ?? []) {
    const path = ownScript(file);
    if (path) {
      return path;
    }
  }
  return undefined;
}

function isVital(name: string): name is WebVital {
  return webVitals.some((vital) => vital === name);
}

function Tracker() {
  const pathname = usePathname();
  const current = useRef<PageView | null>(null);
  const landing = useRef<string | null>(null);
  const lastInput = useRef<number | undefined>(undefined);

  const reportVital = useCallback(({ name, value }: { name: string; value: number }) => {
    if (landing.current && isVital(name)) {
      send({ type: 'vital', view: landing.current, name, value });
    }
  }, []);
  useReportWebVitals(reportVital);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const block = entry.target.getAttribute('data-read');
          if (block && entry.isIntersecting) {
            current.current?.reading.enter(block);
          } else if (block) {
            current.current?.reading.leave(block);
          }
        }
      },
      { rootMargin: '-25% 0px -25% 0px' },
    );
    const start = (landed: boolean, withReferrer: boolean) => {
      const view = begin(withReferrer, lastInput.current);
      current.current = view;
      if (landed) {
        landing.current = view.id;
      }
      observer.disconnect();
      for (const element of document.querySelectorAll('[data-read]')) {
        observer.observe(element);
      }
    };
    const onPageShow = ({ persisted }: PageTransitionEvent) => {
      if (persisted) {
        start(true, false);
      }
    };

    start(landing.current === null, landing.current === null);
    const timer = setInterval(() => {
      const view = current.current;
      if (view?.reading.newlyRead()) {
        flush(view);
      }
    }, 1000);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pageshow', onPageShow);
      observer.disconnect();
      if (current.current) {
        flush(current.current);
      }
    };
  }, [pathname]);

  useEffect(() => {
    const onInput = () => {
      lastInput.current = performance.now();
      current.current?.reading.input();
    };
    const onScroll = () => current.current?.reading.scrolled(scrollDepth());
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
    const onClick = (event: MouseEvent) => {
      const view = current.current;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      const href = link?.getAttribute('href');
      if (view && href && event.button !== 2 && outbound(href)) {
        send({ type: 'click', view: view.id, href });
      }
    };
    const report = (message: string, source: string, line?: number, column?: number) => {
      const view = current.current;
      if (!view || view.errors >= maxErrors) {
        return;
      }
      view.errors += 1;
      send({
        type: 'error',
        view: view.id,
        message: message.slice(0, errorMessageMaxLength),
        source,
        line,
        column,
      });
    };
    const onError = (event: ErrorEvent) => {
      const source = ownScript(event.filename);
      if (source) {
        report(event.message, source, event.lineno, event.colno);
      }
    };
    const onRejection = ({ reason }: PromiseRejectionEvent) => {
      const source = reason instanceof Error ? ownFrame(reason.stack) : undefined;
      if (reason instanceof Error && source) {
        report(reason.message, source);
      }
    };

    const inputs = ['wheel', 'pointerdown', 'keydown', 'touchstart'] as const;
    for (const name of inputs) {
      window.addEventListener(name, onInput, { passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
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
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('auxclick', onClick, true);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}

class Contained extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function VisitTracker() {
  const pathname = usePathname();
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return null;
  }
  return (
    <Contained>
      <Tracker />
    </Contained>
  );
}
