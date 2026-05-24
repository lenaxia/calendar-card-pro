/**
 * NowLineController — owns the time-grid view's "now" indicator state.
 *
 * Idiomatic Lit 3 ReactiveController. Exposes `now` as a getter; updates
 * it (and triggers a host re-render) on three triggers:
 *   1. 60-second interval tick.
 *   2. Local-day rollover detected during a tick.
 *   3. Visibility resume (tab visible) or intersection resume (on-screen).
 *
 * Activation requires view='time-grid' AND show_now_line=true AND tab
 * visible AND host on-screen. The IntersectionObserver gate pauses ticks
 * for cards on inactive HA dashboard tabs (which keep visibilityState
 * visible but are not actually rendered).
 *
 * The single-source-of-truth `now` keeps past-event styling coherent with
 * the now-line position across all renders within a tick window: the
 * renderer reads `ctx.now` from the controller rather than calling
 * `new Date()` itself.
 */

import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type * as Types from '../config/types';
import * as Grid from '../utils/grid';

const NOW_LINE_TICK_MS = 60_000;

/** Structural host interface so the controller is testable with stubs. */
export interface NowLineHost extends ReactiveControllerHost {
  isConnected: boolean;
  config: Types.Config;
  readonly hostElement: Element;
}

export class NowLineController implements ReactiveController {
  private readonly host: NowLineHost;
  private intervalId?: number;
  private intersectionObserver?: IntersectionObserver;
  private isOnScreen = true;
  private isTabVisible = true;
  private nowMs: number;
  private lastRenderDayMs: number;

  constructor(host: NowLineHost) {
    this.host = host;
    const initial = new Date();
    this.nowMs = initial.getTime();
    this.lastRenderDayMs = Grid.startOfDay(initial).getTime();
    host.addController(this);
  }

  /** Authoritative "now"; stable across all renders within a tick window. */
  get now(): Date {
    return new Date(this.nowMs);
  }

  hostConnected(): void {
    this.isTabVisible = document.visibilityState === 'visible';
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.attachIntersectionObserver();
    this.syncActive();
  }

  hostDisconnected(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.detachIntersectionObserver();
    this.stop();
  }

  hostUpdated(): void {
    this.syncActive();
  }

  /** True when the controller currently "wants" to be ticking. */
  get isActive(): boolean {
    return (
      this.host.isConnected &&
      this.host.config?.view === 'time-grid' &&
      this.host.config?.time_grid_show_now_line === true &&
      this.isTabVisible &&
      this.isOnScreen
    );
  }

  private syncActive(): void {
    const want = this.isActive;
    const running = this.intervalId !== undefined;
    if (want && !running) {
      this.start();
    } else if (!want && running) {
      this.stop();
    }
  }

  private start(): void {
    if (this.intervalId !== undefined) return;
    // Refresh on (re)start so a long-hidden tab doesn't show stale time.
    this.tick();
    this.intervalId = window.setInterval(() => this.tick(), NOW_LINE_TICK_MS);
  }

  private stop(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private tick(): void {
    const now = new Date();
    this.nowMs = now.getTime();
    if (Grid.hasDayChanged(this.lastRenderDayMs, now)) {
      this.lastRenderDayMs = Grid.startOfDay(now).getTime();
    }
    // Re-render: renderer reads ctx.now from this.now; event pastness +
    // now-line position derive from it and stay coherent.
    this.host.requestUpdate();
  }

  private onVisibilityChange = (): void => {
    const next = document.visibilityState === 'visible';
    if (next === this.isTabVisible) return;
    this.isTabVisible = next;
    this.syncActive();
  };

  private attachIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') {
      // Pre-IO browsers: assume on-screen; visibility-only gating.
      this.isOnScreen = true;
      return;
    }
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this.isOnScreen = entry.isIntersecting;
        }
        this.syncActive();
      },
      { threshold: 0 },
    );
    this.intersectionObserver.observe(this.host.hostElement);
  }

  private detachIntersectionObserver(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = undefined;
    }
  }
}
