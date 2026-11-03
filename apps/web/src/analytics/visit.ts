import type { VisitEvent } from '@portfolio/content/analytics';
import { PageViews, pathOf } from './page-views';

export function trackVisit(script: HTMLOrSVGScriptElement | null): () => void {
  if (!(script instanceof HTMLScriptElement)) {
    return () => undefined;
  }
  const endpoint = new URL('/api/events', script.src).href;
  const post = (event: VisitEvent) =>
    fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(event),
      keepalive: true,
      credentials: 'omit',
    });
  let viewSent: Promise<unknown> = Promise.resolve();
  const send = (event: VisitEvent) => {
    if (event.type === 'view') {
      viewSent = post(event);
      viewSent.catch(() => undefined);
    } else {
      viewSent.then(() => post(event)).catch(() => undefined);
    }
  };
  const views = new PageViews(send, {
    path: () => pathOf(`/${location.pathname.split('/')[1] ?? ''}`),
    depthAtStart: false,
  });
  let actionsSent = new Set<string>();

  const onPageShow = ({ persisted }: PageTransitionEvent) => {
    if (persisted) {
      actionsSent = new Set();
      views.start(false);
    }
  };
  const onAction = (event: Event) => {
    const view = views.current;
    if (
      !view ||
      !(event instanceof CustomEvent) ||
      typeof event.detail !== 'string' ||
      actionsSent.has(event.detail)
    ) {
      return;
    }
    actionsSent.add(event.detail);
    send({ type: 'action', view: view.id, name: event.detail });
  };

  views.start(true);
  const stopListening = views.listen();
  window.addEventListener('pageshow', onPageShow);
  document.addEventListener('najafov:action', onAction);
  return () => {
    stopListening();
    window.removeEventListener('pageshow', onPageShow);
    document.removeEventListener('najafov:action', onAction);
  };
}
