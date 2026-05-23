// @vitest-environment happy-dom
import type { ReactiveController } from 'lit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG } from '../../src/config/config';
import * as Types from '../../src/config/types';
import { ResponsiveColumnsController } from '../../src/controllers/responsive-columns-controller';

// In-memory ResizeObserver stub: lets tests trigger callbacks deterministically.
type RoCallback = (entries: ResizeObserverEntry[]) => void;
let activeObservers: Array<{ cb: RoCallback; targets: Set<Element> }> = [];

class StubResizeObserver {
  cb: RoCallback;
  targets = new Set<Element>();
  constructor(cb: RoCallback) {
    this.cb = cb;
    activeObservers.push(this);
  }
  observe(target: Element): void {
    this.targets.add(target);
  }
  unobserve(target: Element): void {
    this.targets.delete(target);
  }
  disconnect(): void {
    this.targets.clear();
    activeObservers = activeObservers.filter((o) => o !== this);
  }
}

// Stub host implementing ResponsiveColumnsHost. Captures controller registration
// and exposes plain-object state for assertions.
function makeHost(initial: { config?: Partial<Types.Config>; offsetWidth?: number } = {}) {
  const controllers: ReactiveController[] = [];
  const host = {
    isConnected: true,
    offsetWidth: initial.offsetWidth ?? 1200,
    config: { ...DEFAULT_CONFIG, ...initial.config } as Types.Config,
    visibleDays: 7 as 1 | 3 | 7,
    viewOffsetDays: 0,
    onVisibleDaysChangedCalls: 0,
    onVisibleDaysChanged() {
      this.onVisibleDaysChangedCalls += 1;
    },
    addController(c: ReactiveController) {
      controllers.push(c);
    },
    _controllers: controllers,
  } as const;
  return host as typeof host & {
    isConnected: boolean;
    offsetWidth: number;
    config: Types.Config;
    visibleDays: 1 | 3 | 7;
    viewOffsetDays: number;
    onVisibleDaysChangedCalls: number;
  };
}

describe('ResponsiveColumnsController', () => {
  let originalRO: typeof globalThis.ResizeObserver;
  let originalRaf: typeof globalThis.requestAnimationFrame;
  let originalCancelRaf: typeof globalThis.cancelAnimationFrame;
  let pendingRaf: Array<() => void>;

  beforeEach(() => {
    originalRO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = StubResizeObserver as unknown as typeof globalThis.ResizeObserver;
    activeObservers = [];

    pendingRaf = [];
    originalRaf = globalThis.requestAnimationFrame;
    originalCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
      pendingRaf.push(() => cb(0));
      return pendingRaf.length;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number): void => {
      pendingRaf[id - 1] = () => {};
    }) as typeof globalThis.cancelAnimationFrame;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalRO;
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancelRaf;
  });

  function flushRaf(): void {
    const queued = pendingRaf;
    pendingRaf = [];
    queued.forEach((cb) => cb());
  }

  it('registers itself with the host on construction', () => {
    const host = makeHost();
    const c = new ResponsiveColumnsController(host);
    expect(host._controllers).toContain(c);
  });

  it('hostConnected attaches an observer when view is time-grid', () => {
    const host = makeHost({ config: { view: 'time-grid' } });
    const c = new ResponsiveColumnsController(host);
    c.hostConnected();
    expect(activeObservers).toHaveLength(1);
  });

  it('hostConnected does NOT attach observer when view is list', () => {
    const host = makeHost({ config: { view: 'list' } });
    const c = new ResponsiveColumnsController(host);
    c.hostConnected();
    expect(activeObservers).toHaveLength(0);
  });

  it('initial measurement on hostConnected applies visibleDays from offsetWidth', () => {
    const host = makeHost({ config: { view: 'time-grid' }, offsetWidth: 400 });
    const c = new ResponsiveColumnsController(host);
    c.hostConnected();
    // 400 < 500 → 1
    expect(host.visibleDays).toBe(1);
    expect(host.onVisibleDaysChangedCalls).toBe(1);
  });

  it('does not call onVisibleDaysChanged when measurement matches current value', () => {
    const host = makeHost({ config: { view: 'time-grid' }, offsetWidth: 1200 });
    // host.visibleDays starts at 7; 1200 → 7 (no change)
    const c = new ResponsiveColumnsController(host);
    c.hostConnected();
    expect(host.visibleDays).toBe(7);
    expect(host.onVisibleDaysChangedCalls).toBe(0);
  });

  it('resize event triggers RAF-coalesced re-measurement', () => {
    const host = makeHost({ config: { view: 'time-grid' }, offsetWidth: 1200 });
    const c = new ResponsiveColumnsController(host);
    c.hostConnected();

    // Shrink → ResizeObserver fires → coalesce via RAF
    host.offsetWidth = 400;
    activeObservers[0].cb([] as unknown as ResizeObserverEntry[]);
    activeObservers[0].cb([] as unknown as ResizeObserverEntry[]);
    activeObservers[0].cb([] as unknown as ResizeObserverEntry[]);
    expect(pendingRaf.length).toBe(1); // coalesced to one RAF call
    flushRaf();
    expect(host.visibleDays).toBe(1);
  });

  it('hostDisconnected detaches observer and cancels pending RAF', () => {
    const host = makeHost({ config: { view: 'time-grid' } });
    const c = new ResponsiveColumnsController(host);
    c.hostConnected();
    expect(activeObservers).toHaveLength(1);
    activeObservers[0].cb([] as unknown as ResizeObserverEntry[]);
    expect(pendingRaf.length).toBe(1);

    c.hostDisconnected();
    expect(activeObservers).toHaveLength(0);
    flushRaf(); // pending RAF was cancelled; no host mutation
  });

  it('hostUpdated: switching list → time-grid attaches observer', () => {
    const host = makeHost({ config: { view: 'list' } });
    const c = new ResponsiveColumnsController(host);
    c.hostConnected();
    expect(activeObservers).toHaveLength(0);

    host.config = { ...host.config, view: 'time-grid' };
    c.hostUpdated();
    expect(activeObservers).toHaveLength(1);
  });

  it('hostUpdated: switching time-grid → list detaches observer', () => {
    const host = makeHost({ config: { view: 'time-grid' } });
    const c = new ResponsiveColumnsController(host);
    c.hostConnected();
    expect(activeObservers).toHaveLength(1);

    host.config = { ...host.config, view: 'list' };
    c.hostUpdated();
    expect(activeObservers).toHaveLength(0);
  });

  it('hostUpdated does NOT re-measure when no breakpoint-relevant config changed (perf)', () => {
    const host = makeHost({ config: { view: 'time-grid' }, offsetWidth: 1200 });
    const c = new ResponsiveColumnsController(host);
    c.hostConnected();

    // Simulate width changing under us WITHOUT the ResizeObserver firing
    // (e.g. mid-render). hostUpdated must NOT re-read offsetWidth — gating
    // on configKey means no spurious measure / no spurious layout.
    host.offsetWidth = 400;
    c.hostUpdated();
    expect(host.visibleDays).toBe(7); // not re-measured
  });

  it('hostUpdated DOES re-measure when a breakpoint-relevant config field changes', () => {
    const host = makeHost({ config: { view: 'time-grid' }, offsetWidth: 800 });
    const c = new ResponsiveColumnsController(host);
    c.hostConnected();
    expect(host.visibleDays).toBe(3); // 800 < 900 → 3

    // Lower the seven-day breakpoint so 800 now qualifies for 7
    host.config = { ...host.config, time_grid_breakpoint_seven_day_px: 700 };
    c.hostUpdated();
    expect(host.visibleDays).toBe(7);
  });

  it('remeasure forces a measurement pass (used after visibilitychange:visible)', () => {
    const host = makeHost({ config: { view: 'time-grid' }, offsetWidth: 1200 });
    const c = new ResponsiveColumnsController(host);
    c.hostConnected();

    host.offsetWidth = 400;
    c.remeasure();
    expect(host.visibleDays).toBe(1);
  });

  it('remeasure is a no-op when not connected', () => {
    const host = makeHost({ config: { view: 'time-grid' } });
    const c = new ResponsiveColumnsController(host);
    c.hostConnected();
    host.isConnected = false;

    host.offsetWidth = 400;
    c.remeasure();
    expect(host.visibleDays).toBe(7); // unchanged
  });
});
