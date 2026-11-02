'use client';

import {
  errorMessageMaxLength,
  webVitals,
  type VisitEvent,
  type WebVital,
} from '@portfolio/content/analytics';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PageViews, pathOf } from './page-views';

const maxErrors = 5;

function send(event: VisitEvent): void {
  const body = new Blob([JSON.stringify(event)], { type: 'application/json' });
  navigator.sendBeacon('/api/events', body);
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
  const [views] = useState(() => new PageViews(send));
  const landing = useRef<string | null>(null);
  const errors = useRef(0);

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
            views.current?.reading.enter(block);
          } else if (block) {
            views.current?.reading.leave(block);
          }
        }
      },
      { rootMargin: '-25% 0px -25% 0px' },
    );
    const start = (landed: boolean, withReferrer: boolean) => {
      const view = views.start(withReferrer);
      errors.current = 0;
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
      if (views.current?.reading.newlyRead()) {
        views.flush();
      }
    }, 1000);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pageshow', onPageShow);
      observer.disconnect();
      views.flush();
    };
  }, [pathname, views]);

  useEffect(() => {
    const stopListening = views.listen();
    const onClick = (event: MouseEvent) => {
      const view = views.current;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      const href = link?.getAttribute('href');
      if (view && href && event.button !== 2 && outbound(href)) {
        send({ type: 'click', view: view.id, href });
      }
    };
    const report = (message: string, source: string, line?: number, column?: number) => {
      const view = views.current;
      if (!view || errors.current >= maxErrors) {
        return;
      }
      errors.current += 1;
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

    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onClick, true);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      stopListening();
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('auxclick', onClick, true);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [views]);

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
