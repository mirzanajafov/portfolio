import type { VisitEvent } from '@portfolio/content/analytics';
import { PageViews, type PageView } from './page-views';

export function trackVisit(script: HTMLOrSVGScriptElement | null): () => void {
  if (!(script instanceof HTMLScriptElement)) {
    return () => undefined;
  }
  const endpoint = new URL('/api/events', script.src).href;
  const send = (event: VisitEvent) => {
    fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(event),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined);
  };
  const views = new PageViews(send);
  const actionsSent = new WeakMap<PageView, Set<string>>();

  const onPageShow = ({ persisted }: PageTransitionEvent) => {
    if (persisted) {
      views.start(false);
    }
  };
  const onAction = (event: Event) => {
    const view = views.current;
    if (!view || !(event instanceof CustomEvent) || typeof event.detail !== 'string') {
      return;
    }
    const sent = actionsSent.get(view) ?? new Set<string>();
    if (!sent.has(event.detail)) {
      sent.add(event.detail);
      actionsSent.set(view, sent);
      send({ type: 'action', view: view.id, name: event.detail });
    }
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
