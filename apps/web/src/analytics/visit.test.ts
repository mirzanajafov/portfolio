import type { VisitEvent } from '@portfolio/content/analytics';
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackVisit } from './visit';

const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));

function isEvent(value: unknown): value is VisitEvent {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function bodies(): string[] {
  return fetchMock.mock.calls.map(([, init]) => (typeof init?.body === 'string' ? init.body : ''));
}

function sent(): VisitEvent[] {
  return bodies()
    .map((body): unknown => JSON.parse(body))
    .filter(isEvent);
}

function aScript(src = 'https://najafov.dev/visit.js'): HTMLScriptElement {
  const script = document.createElement('script');
  script.src = src;
  return script;
}

function setReferrer(referrer: string) {
  Object.defineProperty(document, 'referrer', { value: referrer, configurable: true });
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

function act(name: unknown) {
  document.dispatchEvent(new CustomEvent('najafov:action', { detail: name }));
}

let stop: () => void = () => undefined;

beforeEach(() => {
  window.history.replaceState({}, '', '/today?r=memh');
  setReferrer('https://najafov.dev/projects/matchium');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  stop();
  setVisibility('visible');
  vi.unstubAllGlobals();
});

describe('trackVisit', () => {
  it('sends a page view to the site the script came from, without cookies, and survives the page closing', () => {
    stop = trackVisit(aScript());
    expect(fetchMock).toHaveBeenCalledWith(
      'https://najafov.dev/api/events',
      expect.objectContaining({ method: 'POST', keepalive: true, credentials: 'omit' }),
    );
    const [view, ...rest] = sent();
    assert(view?.type === 'view');
    expect(rest).toEqual([]);
    expect(view).toEqual({
      type: 'view',
      id: view.id,
      path: '/today',
      referrer: 'najafov.dev',
      ref: 'memh',
      notFound: false,
    });
  });

  it("leaves out a referrer from the demo's own pages", () => {
    setReferrer(`${location.origin}/signup`);
    stop = trackVisit(aScript());
    expect(sent()[0]).not.toHaveProperty('referrer');
  });

  it('sends the reading so far when the tab is hidden and when the page goes, after its view and to the same site', async () => {
    stop = trackVisit(aScript('http://localhost:3210/visit.js'));
    setVisibility('hidden');
    window.dispatchEvent(new Event('pagehide'));

    await vi.waitFor(() => {
      expect(sent()).toHaveLength(3);
    });
    const [view, hidden, gone] = sent();
    assert(view?.type === 'view');
    expect(hidden).toMatchObject({ type: 'read', view: view.id, seq: 1, blocks: {} });
    expect(gone).toMatchObject({ type: 'read', view: view.id, seq: 2 });
    expect(new Set(fetchMock.mock.calls.map(([url]) => url))).toEqual(
      new Set(['http://localhost:3210/api/events']),
    );
  });

  it('sends each action once a page view, and again in the page view after a return from the back-forward cache', async () => {
    stop = trackVisit(aScript());
    act('answered');
    act('answered');
    act('liked');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    act('answered');

    await vi.waitFor(() => {
      expect(sent()).toHaveLength(5);
    });
    const [first, restored, ...actions] = sent();
    assert(first?.type === 'view' && restored?.type === 'view');
    expect(restored.id).not.toBe(first.id);
    expect(restored).not.toHaveProperty('referrer');
    expect(actions).toEqual([
      { type: 'action', view: first.id, name: 'answered' },
      { type: 'action', view: first.id, name: 'liked' },
      { type: 'action', view: restored.id, name: 'answered' },
    ]);
  });

  it('sends an action only once its page view has arrived, so the step finds the view to land on', async () => {
    let arrive: (response: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          arrive = resolve;
        }),
    );
    stop = trackVisit(aScript());
    act('answered');
    await Promise.resolve();
    expect(sent().map(({ type }) => type)).toEqual(['view']);

    arrive(new Response(null, { status: 204 }));
    await vi.waitFor(() => {
      expect(sent().map(({ type }) => type)).toEqual(['view', 'action']);
    });
  });

  it('records only the first part of the address, because a demo puts ids in the rest', () => {
    window.history.replaceState({}, '', '/chats/9f8e7d6c?r=memh');
    stop = trackVisit(aScript());
    expect(sent()[0]).toMatchObject({ type: 'view', path: '/chats', ref: 'memh' });
  });

  it('takes scroll depth only from scrolling, since a demo may not have drawn its page when the script runs', async () => {
    stop = trackVisit(aScript());
    setVisibility('hidden');
    await vi.waitFor(() => {
      expect(sent()[1]).toMatchObject({ type: 'read', maxScroll: 0 });
    });
  });

  it('ignores an action that is not a name', () => {
    stop = trackVisit(aScript());
    act({ name: 'answered' });
    act(undefined);
    expect(sent().map(({ type }) => type)).toEqual(['view']);
  });

  it('never sends what the page holds: its cookies, its storage or what was typed into it', async () => {
    document.cookie = 'matchium_session=secret-session';
    localStorage.setItem('marauder_token', 'secret-token');
    const input = document.createElement('input');
    input.value = 'secret-typed';
    document.body.append(input);
    stop = trackVisit(aScript());
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    act('answered');
    setVisibility('hidden');

    await vi.waitFor(() => {
      expect(sent().map(({ type }) => type)).toEqual(['view', 'action', 'read']);
    });
    expect(bodies().join('\n')).not.toMatch(/secret/);
    input.remove();
    localStorage.clear();
    document.cookie = 'matchium_session=; max-age=0';
  });

  it('keeps the page working when the site cannot be reached, and sends no action for a view that never arrived', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(() => {
      stop = trackVisit(aScript());
      act('answered');
    }).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent().map(({ type }) => type)).toEqual(['view']);
  });

  it('does nothing when it was not loaded by a script tag', () => {
    stop = trackVisit(null);
    act('answered');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
