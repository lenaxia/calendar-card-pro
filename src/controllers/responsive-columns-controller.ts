/**
 * ResponsiveColumnsController — owns the time-grid view's responsive column
 * count. Wraps a single ResizeObserver with RAF-coalesced updates.
 *
 * Idiomatic Lit 3 ReactiveController: activated only when
 * `config.view === 'time-grid'`; fully inert in list view. The controller
 * writes `host.visibleDays` after each measurement and notifies the host so
 * `viewOffsetDays` can be re-clamped against the new max.
 */

import type { ReactiveController } from 'lit';

import type * as Types from '../config/types';
import * as Grid from '../utils/grid';

/** Structural host interface so the controller is testable with stubs. */
export interface ResponsiveColumnsHost {
  isConnected: boolean;
  readonly offsetWidth: number;
  config: Types.Config;
  visibleDays: 1 | 3 | 7;
  viewOffsetDays: number;
  onVisibleDaysChanged(): void;
  addController(controller: ReactiveController): void;
}

export class ResponsiveColumnsController implements ReactiveController {
  private readonly host: ResponsiveColumnsHost;
  private observer?: ResizeObserver;
  private rafId?: number;
  // Tuple of the last config values that affect responsive layout. Used by
  // hostUpdated to skip the layout-forcing offsetWidth read on reactive
  // updates that did not change a relevant field. Re-measurement still
  // happens via the ResizeObserver when actual size changes.
  private lastConfigKey?: string;

  constructor(host: ResponsiveColumnsHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected(): void {
    this.sync();
    if (this.host.config.view === 'time-grid') {
      this.measure(this.host.offsetWidth);
      this.lastConfigKey = this.configKey();
    }
  }

  hostDisconnected(): void {
    this.teardown();
  }

  /**
   * Called by the host after each render cycle. Re-syncs the observer
   * (attach if just became time-grid; detach if left). Re-measures only
   * when a config field that affects breakpoint resolution actually
   * changed; otherwise the ResizeObserver already covers actual resizes
   * and a redundant offsetWidth read would force an unnecessary layout.
   */
  hostUpdated(): void {
    this.sync();
    if (this.host.config.view !== 'time-grid') {
      this.lastConfigKey = undefined;
      return;
    }
    const key = this.configKey();
    if (key !== this.lastConfigKey) {
      this.lastConfigKey = key;
      this.measure(this.host.offsetWidth);
    }
  }

  /**
   * Force a re-measurement (called by the host after visibilitychange:'visible'
   * since ResizeObserver does not fire when an inactive HA dashboard tab
   * becomes active without an actual size change).
   */
  remeasure(): void {
    if (this.host.config.view === 'time-grid' && this.host.isConnected) {
      this.measure(this.host.offsetWidth);
    }
  }

  private sync(): void {
    const wantObserver = this.host.config.view === 'time-grid' && this.host.isConnected;
    if (wantObserver && !this.observer) {
      // Arrow function preserves `this` (AGENTS.md Common Mistake #5).
      this.observer = new ResizeObserver(() => this.onResize());
      this.observer.observe(this.host as unknown as Element);
    } else if (!wantObserver && this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
      if (this.rafId !== undefined) {
        cancelAnimationFrame(this.rafId);
        this.rafId = undefined;
      }
    }
  }

  private onResize(): void {
    if (this.rafId !== undefined) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = undefined;
      this.measure(this.host.offsetWidth);
    });
  }

  private measure(widthPx: number): void {
    const next = Grid.chooseVisibleDays(
      widthPx,
      this.host.config.time_grid_breakpoint_three_day_px,
      this.host.config.time_grid_breakpoint_seven_day_px,
      this.host.config.time_grid_max_days,
    );
    if (next !== this.host.visibleDays) {
      this.host.visibleDays = next;
      this.host.onVisibleDaysChanged();
    }
  }

  /** Joined config tuple used to detect breakpoint-relevant changes. */
  private configKey(): string {
    const c = this.host.config;
    return `${c.time_grid_breakpoint_three_day_px}/${c.time_grid_breakpoint_seven_day_px}/${c.time_grid_max_days}`;
  }

  private teardown(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
  }
}
