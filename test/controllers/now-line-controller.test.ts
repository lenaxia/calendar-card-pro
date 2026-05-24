// @vitest-environment happy-dom
import type { ReactiveController } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_CONFIG } from '../../src/config/config';
import * as Types from '../../src/config/types';
import { NowLineController } from '../../src/controllers/now-line-controller';

type IoCallback = (entries: IntersectionObserverEntry[]) => void;
let activeIos: Array<{ cb: IoCallback }> = [];

class StubIntersectionObserver {
  cb: IoCallback;
  constructor(cb: IoCallback) {
    this.cb = cb;
    activeIos.push(this);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    activeIos = activeIos.filter((o) => o !== this);
  }
}

function makeHost(initial: { config?: Partial<Types.Config> } = {}) {
  const controllers: ReactiveController[] = [];
  const dummyEl = document.createElement('div');
  const host = {
    isConnected: true,
    config: { ...DEFAULT_CONFIG, ...initial.config } as Types.Config,
    hostElement: dummyEl,
    requestUpdateCalls: 0,
    requestUpdate() {
      this.requestUpdateCalls += 1;
    },
    updateComplete: Promise.resolve(true),
    addController(c: ReactiveController) {
      controllers.push(c);
    },
    removeController(c: ReactiveController) {
      const idx = controllers.indexOf(c);
      if (idx >= 0) controllers.splice(idx, 1);
    },
    _controllers: controllers,
  };
  return host as typeof host & {
    isConnected: boolean;
    config: Types.Config;
    hostElement: Element;
    requestUpdateCalls: number;
  };
}

describe('NowLineController', () => {
  let originalIO: typeof globalThis.IntersectionObserver;

  beforeEach(() => {
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver =
      StubIntersectionObserver as unknown as typeof globalThis.IntersectionObserver;
    activeIos = [];
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO;
    vi.useRealTimers();
  });

  it('registers itself with the host', () => {
    const host = makeHost();
    const c = new NowLineController(host);
    expect(host._controllers).toContain(c);
  });

  it('exposes a "now" Date getter (initial value near construction time)', () => {
    const host = makeHost();
    const c = new NowLineController(host);
    expect(c.now).toBeInstanceOf(Date);
    expect(Math.abs(c.now.getTime() - Date.now())).toBeLessThan(1000);
  });

  it('isActive is false in list view', () => {
    const host = makeHost({ config: { view: 'list' } });
    const c = new NowLineController(host);
    c.hostConnected();
    expect(c.isActive).toBe(false);
  });

  it('isActive is false when show_now_line is false', () => {
    const host = makeHost({ config: { view: 'time-grid', time_grid_show_now_line: false } });
    const c = new NowLineController(host);
    c.hostConnected();
    expect(c.isActive).toBe(false);
  });

  it('isActive is true when view=time-grid + show_now_line=true + visible + on-screen', () => {
    const host = makeHost({ config: { view: 'time-grid', time_grid_show_now_line: true } });
    const c = new NowLineController(host);
    c.hostConnected();
    expect(c.isActive).toBe(true);
  });

  it('60s tick triggers requestUpdate', () => {
    const host = makeHost({ config: { view: 'time-grid', time_grid_show_now_line: true } });
    const c = new NowLineController(host);
    c.hostConnected();
    const before = host.requestUpdateCalls;
    vi.advanceTimersByTime(60_000);
    expect(host.requestUpdateCalls).toBe(before + 1);
  });

  it('hostDisconnected stops the interval', () => {
    const host = makeHost({ config: { view: 'time-grid', time_grid_show_now_line: true } });
    const c = new NowLineController(host);
    c.hostConnected();
    c.hostDisconnected();
    const before = host.requestUpdateCalls;
    vi.advanceTimersByTime(60_000);
    expect(host.requestUpdateCalls).toBe(before);
  });

  it('hostDisconnected disconnects IntersectionObserver', () => {
    const host = makeHost({ config: { view: 'time-grid', time_grid_show_now_line: true } });
    const c = new NowLineController(host);
    c.hostConnected();
    expect(activeIos).toHaveLength(1);
    c.hostDisconnected();
    expect(activeIos).toHaveLength(0);
  });

  it('IntersectionObserver pause: off-screen entry stops the tick', () => {
    const host = makeHost({ config: { view: 'time-grid', time_grid_show_now_line: true } });
    const c = new NowLineController(host);
    c.hostConnected();
    const before = host.requestUpdateCalls;

    activeIos[0].cb([{ isIntersecting: false } as IntersectionObserverEntry]);
    expect(c.isActive).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(host.requestUpdateCalls).toBe(before);
  });

  it('IntersectionObserver resume: on-screen entry restarts the tick', () => {
    const host = makeHost({ config: { view: 'time-grid', time_grid_show_now_line: true } });
    const c = new NowLineController(host);
    c.hostConnected();
    activeIos[0].cb([{ isIntersecting: false } as IntersectionObserverEntry]);
    activeIos[0].cb([{ isIntersecting: true } as IntersectionObserverEntry]);
    expect(c.isActive).toBe(true);
    const before = host.requestUpdateCalls;
    vi.advanceTimersByTime(60_000);
    expect(host.requestUpdateCalls).toBeGreaterThan(before);
  });

  it('hostUpdated: toggling show_now_line on then off starts/stops correctly', () => {
    const host = makeHost({ config: { view: 'time-grid', time_grid_show_now_line: false } });
    const c = new NowLineController(host);
    c.hostConnected();
    expect(c.isActive).toBe(false);

    host.config = { ...host.config, time_grid_show_now_line: true };
    c.hostUpdated();
    expect(c.isActive).toBe(true);

    host.config = { ...host.config, time_grid_show_now_line: false };
    c.hostUpdated();
    expect(c.isActive).toBe(false);
  });

  it('start is idempotent (no double-interval)', () => {
    const host = makeHost({ config: { view: 'time-grid', time_grid_show_now_line: true } });
    const c = new NowLineController(host);
    c.hostConnected();
    // Force re-evaluation
    c.hostUpdated();
    c.hostUpdated();
    const before = host.requestUpdateCalls;
    vi.advanceTimersByTime(60_000);
    // One requestUpdate per tick, regardless of how many hostUpdated calls
    expect(host.requestUpdateCalls).toBe(before + 1);
  });

  it('now advances after a tick', () => {
    const host = makeHost({ config: { view: 'time-grid', time_grid_show_now_line: true } });
    const c = new NowLineController(host);
    c.hostConnected();
    const t0 = c.now.getTime();
    vi.advanceTimersByTime(60_000);
    const t1 = c.now.getTime();
    expect(t1).toBeGreaterThanOrEqual(t0 + 60_000);
  });

  it('detects local-day rollover and triggers a re-render (M5/H3 regression)', () => {
    const beforeMidnight = new Date(2026, 4, 13, 23, 59, 30);
    vi.setSystemTime(beforeMidnight);

    const host = makeHost({ config: { view: 'time-grid', time_grid_show_now_line: true } });
    const c = new NowLineController(host);
    c.hostConnected();

    const updatesBefore = host.requestUpdateCalls;
    vi.advanceTimersByTime(60_000);

    expect(host.requestUpdateCalls).toBeGreaterThan(updatesBefore);
    expect(c.now.getDate()).toBe(14);

    const after = host.requestUpdateCalls;
    vi.advanceTimersByTime(60_000);
    expect(host.requestUpdateCalls).toBe(after + 1);
  });

  it('view list <-> time-grid activation/deactivation (M7 coverage)', () => {
    const host = makeHost({ config: { view: 'list', time_grid_show_now_line: true } });
    const c = new NowLineController(host);
    c.hostConnected();
    expect(c.isActive).toBe(false);

    host.config = { ...host.config, view: 'time-grid' };
    c.hostUpdated();
    expect(c.isActive).toBe(true);

    host.config = { ...host.config, view: 'list' };
    c.hostUpdated();
    expect(c.isActive).toBe(false);
  });
});
