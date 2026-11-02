import { maxPathLength, type VisitEvent } from '@portfolio/content/analytics';
import { Reading } from './reading';

export type PageView = { id: string; reading: Reading; seq: number };

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

export function pathOf(path: string): string {
  return path
    .replace(/^\/+/, '/')
    .replace(/[[\]^|]/g, encodeURIComponent)
    .slice(0, maxPathLength)
    .replace(/%[0-9A-F]?$/i, '');
}

const inputs = ['wheel', 'pointerdown', 'keydown', 'touchstart'] as const;

export class PageViews {
  current: PageView | null = null;
  private lastInput: number | undefined;

  constructor(private readonly send: (event: VisitEvent) => void) {}

  start(withReferrer: boolean): PageView {
    const view = {
      id: crypto.randomUUID(),
      reading: new Reading(() => performance.now(), this.lastInput),
      seq: 0,
    };
    view.reading.scrolled(scrollDepth());
    this.current = view;
    this.send({
      type: 'view',
      id: view.id,
      path: pathOf(location.pathname),
      referrer: withReferrer ? referrerHost() : undefined,
      ref: new URLSearchParams(location.search).get('r') ?? undefined,
      notFound: document.querySelector('[data-not-found]') !== null,
    });
    return view;
  }

  flush(): void {
    const view = this.current;
    if (view) {
      view.seq += 1;
      this.send({ type: 'read', view: view.id, seq: view.seq, ...view.reading.snapshot() });
    }
  }

  listen(): () => void {
    const onInput = () => {
      this.lastInput = performance.now();
      this.current?.reading.input();
    };
    const onScroll = () => this.current?.reading.scrolled(scrollDepth());
    const onVisibility = () => {
      const visible = document.visibilityState === 'visible';
      this.current?.reading.setVisible(visible);
      if (!visible) {
        this.flush();
      }
    };
    const onPageHide = () => this.flush();

    for (const name of inputs) {
      window.addEventListener(name, onInput, { passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      for (const name of inputs) {
        window.removeEventListener(name, onInput);
      }
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }
}
