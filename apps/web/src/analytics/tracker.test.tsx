import type { VisitEvent } from '@portfolio/content/analytics';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisitTracker } from './tracker';

type Metric = { name: string; value: number };

const navigation = vi.hoisted(() => ({ pathname: '/' }));
const vitals = vi.hoisted(() => {
  const holder: { report?: (metric: Metric) => void } = {};
  return holder;
});

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));
vi.mock('next/web-vitals', () => ({
  useReportWebVitals: (report: (metric: Metric) => void) => {
    vitals.report = report;
  },
}));

const sendBeacon = vi.fn((url: string, body: Blob) => url !== '' && body.size > 0);

const noRect: DOMRectReadOnly = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON: () => ({}),
};

class FakeObserver implements IntersectionObserver {
  static latest?: FakeObserver;
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds = [];
  readonly observed = new Set<Element>();

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.latest = this;
  }

  observe(element: Element) {
    this.observed.add(element);
  }

  unobserve(element: Element) {
    this.observed.delete(element);
  }

  disconnect() {
    this.observed.clear();
  }

  takeRecords() {
    return [];
  }

  show(target: Element, isIntersecting: boolean) {
    this.callback(
      [
        {
          target,
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          boundingClientRect: noRect,
          intersectionRect: noRect,
          rootBounds: null,
          time: 0,
        },
      ],
      this,
    );
  }
}

function isEvent(value: unknown): value is VisitEvent {
  return typeof value === 'object' && value !== null && 'type' in value;
}

async function sent(): Promise<VisitEvent[]> {
  const bodies = await Promise.all(sendBeacon.mock.calls.map(([, body]) => body.text()));
  return bodies.map((body): unknown => JSON.parse(body)).filter(isEvent);
}

function setReferrer(referrer: string) {
  Object.defineProperty(document, 'referrer', { value: referrer, configurable: true });
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

function observer(): FakeObserver {
  assert(FakeObserver.latest);
  return FakeObserver.latest;
}

beforeEach(() => {
  navigation.pathname = '/';
  window.history.replaceState({}, '', '/?r=memh');
  setReferrer('https://www.linkedin.com/feed/');
  Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });
  sendBeacon.mockClear();
});

afterEach(() => {
  setVisibility('visible');
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('VisitTracker', () => {
  it('sends a page view with the code from the link and the host that sent the visitor', async () => {
    render(<VisitTracker />);
    expect(sendBeacon).toHaveBeenCalledWith('/api/events', expect.any(Blob));
    const [view, ...rest] = await sent();
    assert(view?.type === 'view');
    expect(rest).toEqual([]);
    expect(view.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(view).toEqual({
      type: 'view',
      id: view.id,
      path: '/',
      referrer: 'www.linkedin.com',
      ref: 'memh',
      notFound: false,
    });
  });

  it('leaves out a referrer from this site', async () => {
    setReferrer(`${location.origin}/cv`);
    render(<VisitTracker />);
    const [view] = await sent();
    expect(view).toMatchObject({ type: 'view', path: '/' });
    expect(view).not.toHaveProperty('referrer');
  });

  it('sends a path the API can take for any missing address', async () => {
    window.history.replaceState({}, '', `${location.origin}//wp-admin/[x]|${'a'.repeat(300)}`);
    render(<VisitTracker />);
    const [view] = await sent();
    assert(view?.type === 'view');
    expect(view.path).toMatch(/^\/(?!\/)[A-Za-z0-9._~%!$&'()*+,;=:@/-]{0,200}$/);
    expect(view.path.startsWith('/wp-admin/%5Bx%5D%7Caaa')).toBe(true);
  });

  it('never cuts a path in the middle of an escape', async () => {
    window.history.replaceState({}, '', `/${'a'.repeat(199)}[x`);
    render(<VisitTracker />);
    const [view] = await sent();
    assert(view?.type === 'view');
    expect(view.path).toBe(`/${'a'.repeat(199)}`);
  });

  it('sends the last reading of a page, then a view of the next one without referrer or code', async () => {
    const { rerender } = render(<VisitTracker />);
    navigation.pathname = '/cv';
    window.history.pushState({}, '', '/cv');
    rerender(<VisitTracker />);

    const [landing, reading, next] = await sent();
    assert(landing?.type === 'view' && reading?.type === 'read' && next?.type === 'view');
    expect(reading).toMatchObject({
      type: 'read',
      view: landing.id,
      seq: 1,
      activeSeconds: 0,
      blocks: {},
    });
    expect(next).toEqual({ type: 'view', id: next.id, path: '/cv', notFound: false });
    expect(next.id).not.toBe(landing.id);
  });

  it('sends the reading so far when the tab is hidden', async () => {
    render(<VisitTracker />);
    setVisibility('hidden');
    expect((await sent()).map(({ type }) => type)).toEqual(['view', 'read']);
  });

  it('counts the seconds a block spends in the middle of the screen and sends a reading once it has 2', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    render(
      <>
        <section data-read="problem" />
        <VisitTracker />
      </>,
    );
    const block = document.querySelector('[data-read="problem"]');
    assert(block);
    expect(observer().observed.has(block)).toBe(true);
    fireEvent.pointerDown(window);
    act(() => {
      observer().show(block, true);
      vi.advanceTimersByTime(1_000);
    });
    expect((await sent()).map(({ type }) => type)).toEqual(['view']);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect((await sent()).at(-1)).toMatchObject({ type: 'read', blocks: { problem: 2 } });
  });

  it('counts a page reached by a click from the click on, without waiting for a scroll', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const page = (
      <>
        <section data-read="experience" />
        <VisitTracker />
      </>
    );
    const { rerender } = render(page);
    fireEvent.pointerDown(window);
    navigation.pathname = '/cv';
    rerender(page);
    const block = document.querySelector('[data-read="experience"]');
    assert(block);
    act(() => {
      observer().show(block, true);
      vi.advanceTimersByTime(3_000);
    });
    setVisibility('hidden');
    expect((await sent()).at(-1)).toMatchObject({ type: 'read', blocks: { experience: 3 } });
  });

  it('takes scrolling as depth only, and a wheel, tap, key or touch as someone being there', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    render(
      <>
        <section data-read="problem" />
        <VisitTracker />
      </>,
    );
    const block = document.querySelector('[data-read="problem"]');
    assert(block);
    fireEvent.scroll(window);
    act(() => {
      observer().show(block, true);
      vi.advanceTimersByTime(3_000);
    });
    expect((await sent()).filter(({ type }) => type === 'read')).toEqual([]);
    fireEvent.wheel(window);
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect((await sent()).at(-1)).toMatchObject({ type: 'read', blocks: { problem: 2 } });
  });

  it('starts a new page view, without referrer, when the page comes back from the back-forward cache', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    render(
      <>
        <section data-read="problem" />
        <VisitTracker />
      </>,
    );
    observer().disconnect();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

    const [landing, restored] = await sent();
    assert(landing?.type === 'view' && restored?.type === 'view');
    expect(restored.id).not.toBe(landing.id);
    expect(restored).not.toHaveProperty('referrer');
    expect(observer().observed.size).toBe(1);
  });

  it('marks a view of the page that says it is not there', async () => {
    render(
      <main data-not-found>
        <VisitTracker />
      </main>,
    );
    expect(await sent()).toEqual([expect.objectContaining({ type: 'view', notFound: true })]);
  });

  it('reports clicks on links that leave the site, on email and on the CV PDF, and no others', async () => {
    render(
      <>
        <a href="https://github.com/ada/tuner">repo</a>
        <a href="mailto:ada@example.com">email</a>
        <a href="/cv.pdf">pdf</a>
        <a href="/cv">cv</a>
        <a href="#tuner">jump</a>
        <VisitTracker />
      </>,
    );
    const stay = (event: Event) => {
      event.preventDefault();
    };
    document.addEventListener('click', stay);
    for (const text of ['repo', 'email', 'pdf', 'cv', 'jump']) {
      fireEvent.click(screen.getByText(text));
    }
    screen
      .getByText('repo')
      .dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 2 }));
    document.removeEventListener('click', stay);

    const clicks = (await sent()).flatMap((event) => (event.type === 'click' ? [event.href] : []));
    expect(clicks).toEqual(['https://github.com/ada/tuner', 'mailto:ada@example.com', '/cv.pdf']);
  });

  it('reports at most five errors a page from the site own scripts, and none from other scripts', async () => {
    render(<VisitTracker />);
    const error = (filename: string) =>
      new ErrorEvent('error', { message: 'x is undefined', filename, lineno: 3, colno: 14 });
    window.dispatchEvent(error('chrome-extension://abc/content.js'));
    window.dispatchEvent(error(''));
    window.dispatchEvent(error(`${location.origin}/_next/static/[x].js`));
    for (let count = 0; count < 6; count += 1) {
      window.dispatchEvent(error(`${location.origin}/_next/static/chunks/a.js`));
    }

    const errors = (await sent()).filter((event) => event.type === 'error');
    expect(errors).toHaveLength(5);
    expect(errors[0]).toMatchObject({ source: '/_next/static/%5Bx%5D.js' });
    expect(errors[1]).toMatchObject({
      message: 'x is undefined',
      source: '/_next/static/chunks/a.js',
      line: 3,
      column: 14,
    });
  });

  it('reports an unhandled rejection only when the site own code threw it', async () => {
    render(<VisitTracker />);
    const rejection = (reason: unknown) =>
      new PromiseRejectionEvent('unhandledrejection', {
        reason,
        promise: Promise.resolve(),
      });
    const own = new Error('fetch failed');
    own.stack = `Error: fetch failed\n    at ask (${location.origin}/_next/static/chunks/b.js:1:220)`;
    const foreign = new Error('quota');
    foreign.stack = 'Error: quota\n    at x (chrome-extension://abc/bg.js:9:9)';
    window.dispatchEvent(rejection(foreign));
    window.dispatchEvent(rejection('a string'));
    window.dispatchEvent(rejection(own));

    const errors = (await sent()).filter((event) => event.type === 'error');
    expect(errors).toEqual([
      expect.objectContaining({ message: 'fetch failed', source: '/_next/static/chunks/b.js' }),
    ]);
  });

  it('books Web Vitals on the page view that loaded the document, and only LCP, INP and CLS', async () => {
    const { rerender } = render(<VisitTracker />);
    navigation.pathname = '/cv';
    rerender(<VisitTracker />);
    vitals.report?.({ name: 'LCP', value: 1800 });
    vitals.report?.({ name: 'FCP', value: 900 });

    const events = await sent();
    const landing = events[0];
    assert(landing?.type === 'view');
    expect(events.filter(({ type }) => type === 'vital')).toEqual([
      { type: 'vital', view: landing.id, name: 'LCP', value: 1800 },
    ]);
  });

  it('keeps the page up when the tracker itself fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new Error('crypto.randomUUID needs a secure context');
    });
    render(
      <>
        <p>the page</p>
        <VisitTracker />
      </>,
    );
    expect(screen.getByText('the page')).toBeInTheDocument();
  });
});
