import type { VisitEvent } from '@portfolio/content/analytics';
import { fireEvent, render, screen } from '@testing-library/react';
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

beforeEach(() => {
  navigation.pathname = '/';
  window.history.replaceState({}, '', '/?r=memh');
  setReferrer('https://www.linkedin.com/feed/');
  Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });
  sendBeacon.mockClear();
});

afterEach(() => {
  setVisibility('visible');
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
    document.removeEventListener('click', stay);

    const clicks = (await sent()).flatMap((event) => (event.type === 'click' ? [event.href] : []));
    expect(clicks).toEqual(['https://github.com/ada/tuner', 'mailto:ada@example.com', '/cv.pdf']);
  });

  it('reports at most five script errors a page, naming scripts from elsewhere only as external', async () => {
    render(<VisitTracker />);
    const error = (filename: string) =>
      new ErrorEvent('error', { message: 'x is undefined', filename, lineno: 3, colno: 14 });
    window.dispatchEvent(error(`${location.origin}/_next/static/chunks/a.js`));
    window.dispatchEvent(error('chrome-extension://abc/content.js'));
    for (let more = 0; more < 5; more += 1) {
      window.dispatchEvent(error(`${location.origin}/_next/static/chunks/a.js`));
    }

    const errors = (await sent()).filter((event) => event.type === 'error');
    expect(errors).toHaveLength(5);
    expect(errors.slice(0, 2)).toEqual([
      expect.objectContaining({ source: '/_next/static/chunks/a.js', line: 3, column: 14 }),
      expect.objectContaining({ source: 'external' }),
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
});
