import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG, hasConfigChanged, validateTimeGridConfig } from '../../src/config/config';
import * as Types from '../../src/config/types';

const make = (overrides: Partial<Types.Config>): Types.Config => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

describe('hasConfigChanged (G-hasConfigChanged spec)', () => {
  it('view list -> time-grid (same other config) returns true', () => {
    const prev = make({ view: 'list' });
    const curr = make({ view: 'time-grid' });
    expect(hasConfigChanged(prev, curr)).toBe(true);
  });

  it('view time-grid, days_to_show 3 -> 5, no other changes returns false', () => {
    const prev = make({ view: 'time-grid', days_to_show: 3 });
    const curr = make({ view: 'time-grid', days_to_show: 5 });
    expect(hasConfigChanged(prev, curr)).toBe(false);
  });

  it('view list, days_to_show 3 -> 5 returns true (list-view refetch)', () => {
    const prev = make({ view: 'list', days_to_show: 3 });
    const curr = make({ view: 'list', days_to_show: 5 });
    expect(hasConfigChanged(prev, curr)).toBe(true);
  });

  it('view list, time_grid_navigation_days 28 -> 14 returns false (ignored in list)', () => {
    const prev = make({ view: 'list', time_grid_navigation_days: 28 });
    const curr = make({ view: 'list', time_grid_navigation_days: 14 });
    expect(hasConfigChanged(prev, curr)).toBe(false);
  });

  it('view time-grid, time_grid_navigation_days 28 -> 14 returns true (grid-view refetch)', () => {
    const prev = make({ view: 'time-grid', time_grid_navigation_days: 28 });
    const curr = make({ view: 'time-grid', time_grid_navigation_days: 14 });
    expect(hasConfigChanged(prev, curr)).toBe(true);
  });
});

describe('validateTimeGridConfig', () => {
  describe('view discriminator', () => {
    it("invalid view 'foo' coerces to 'list'", () => {
      const c = make({ view: 'foo' as Types.Config['view'] });
      validateTimeGridConfig(c);
      expect(c.view).toBe('list');
    });

    it("'list' is preserved", () => {
      const c = make({ view: 'list' });
      validateTimeGridConfig(c);
      expect(c.view).toBe('list');
    });

    it("'time-grid' is preserved", () => {
      const c = make({ view: 'time-grid' });
      validateTimeGridConfig(c);
      expect(c.view).toBe('time-grid');
    });
  });

  describe('hour range (resets only the offending field)', () => {
    it('invalid start_hour resets only start_hour', () => {
      const c = make({ time_grid_start_hour: -1, time_grid_end_hour: 22 });
      validateTimeGridConfig(c);
      expect(c.time_grid_start_hour).toBe(DEFAULT_CONFIG.time_grid_start_hour);
      expect(c.time_grid_end_hour).toBe(22);
    });

    it('invalid end_hour resets only end_hour', () => {
      const c = make({ time_grid_start_hour: 8, time_grid_end_hour: 25 });
      validateTimeGridConfig(c);
      expect(c.time_grid_start_hour).toBe(8);
      expect(c.time_grid_end_hour).toBe(DEFAULT_CONFIG.time_grid_end_hour);
    });

    it('both invalid resets both', () => {
      const c = make({ time_grid_start_hour: -1, time_grid_end_hour: 25 });
      validateTimeGridConfig(c);
      expect(c.time_grid_start_hour).toBe(DEFAULT_CONFIG.time_grid_start_hour);
      expect(c.time_grid_end_hour).toBe(DEFAULT_CONFIG.time_grid_end_hour);
    });

    it('start >= end (semantic invariant) resets both', () => {
      const c = make({ time_grid_start_hour: 22, time_grid_end_hour: 6 });
      validateTimeGridConfig(c);
      expect(c.time_grid_start_hour).toBe(DEFAULT_CONFIG.time_grid_start_hour);
      expect(c.time_grid_end_hour).toBe(DEFAULT_CONFIG.time_grid_end_hour);
    });

    it('non-integer start_hour resets it', () => {
      const c = make({ time_grid_start_hour: 6.5, time_grid_end_hour: 22 });
      validateTimeGridConfig(c);
      expect(c.time_grid_start_hour).toBe(DEFAULT_CONFIG.time_grid_start_hour);
    });
  });

  describe('interval_minutes', () => {
    it.each([15, 30, 60])('valid value %i is preserved', (v) => {
      const c = make({ time_grid_interval_minutes: v as 15 | 30 | 60 });
      validateTimeGridConfig(c);
      expect(c.time_grid_interval_minutes).toBe(v);
    });

    it('invalid value 45 resets to 30', () => {
      const c = make({ time_grid_interval_minutes: 45 as unknown as 15 | 30 | 60 });
      validateTimeGridConfig(c);
      expect(c.time_grid_interval_minutes).toBe(DEFAULT_CONFIG.time_grid_interval_minutes);
    });
  });

  describe('max_days', () => {
    it.each([1, 3, 7])('valid value %i is preserved', (v) => {
      const c = make({ time_grid_max_days: v as 1 | 3 | 7 });
      validateTimeGridConfig(c);
      expect(c.time_grid_max_days).toBe(v);
    });

    it('invalid value 5 resets to default 7', () => {
      const c = make({ time_grid_max_days: 5 as unknown as 1 | 3 | 7 });
      validateTimeGridConfig(c);
      expect(c.time_grid_max_days).toBe(DEFAULT_CONFIG.time_grid_max_days);
    });

    it('invalid value 0 resets to default', () => {
      const c = make({ time_grid_max_days: 0 as unknown as 1 | 3 | 7 });
      validateTimeGridConfig(c);
      expect(c.time_grid_max_days).toBe(DEFAULT_CONFIG.time_grid_max_days);
    });
  });

  describe('navigation_days', () => {
    it('value 28 is preserved', () => {
      const c = make({ time_grid_navigation_days: 28 });
      validateTimeGridConfig(c);
      expect(c.time_grid_navigation_days).toBe(28);
    });

    it('zero resets to default', () => {
      const c = make({ time_grid_navigation_days: 0 });
      validateTimeGridConfig(c);
      expect(c.time_grid_navigation_days).toBe(DEFAULT_CONFIG.time_grid_navigation_days);
    });

    it('negative resets to default', () => {
      const c = make({ time_grid_navigation_days: -5 });
      validateTimeGridConfig(c);
      expect(c.time_grid_navigation_days).toBe(DEFAULT_CONFIG.time_grid_navigation_days);
    });

    it('non-integer resets to default', () => {
      const c = make({ time_grid_navigation_days: 14.5 });
      validateTimeGridConfig(c);
      expect(c.time_grid_navigation_days).toBe(DEFAULT_CONFIG.time_grid_navigation_days);
    });

    it('above 365 resets to default', () => {
      const c = make({ time_grid_navigation_days: 1000 });
      validateTimeGridConfig(c);
      expect(c.time_grid_navigation_days).toBe(DEFAULT_CONFIG.time_grid_navigation_days);
    });
  });

  describe('max_days <= navigation_days invariant (Bug #5 / H3)', () => {
    it('max_days 7 with nav_days 3 reduces max_days to 3', () => {
      const c = make({ time_grid_max_days: 7, time_grid_navigation_days: 3 });
      validateTimeGridConfig(c);
      expect(c.time_grid_max_days).toBe(3);
    });

    it('max_days 3 with nav_days 1 reduces max_days to 1', () => {
      const c = make({ time_grid_max_days: 3, time_grid_navigation_days: 1 });
      validateTimeGridConfig(c);
      expect(c.time_grid_max_days).toBe(1);
    });

    it('max_days 7 with nav_days 5 reduces max_days to 3 (largest allowed)', () => {
      const c = make({ time_grid_max_days: 7, time_grid_navigation_days: 5 });
      validateTimeGridConfig(c);
      expect(c.time_grid_max_days).toBe(3);
    });

    it('max_days 3 with nav_days 7 unchanged (already <=)', () => {
      const c = make({ time_grid_max_days: 3, time_grid_navigation_days: 7 });
      validateTimeGridConfig(c);
      expect(c.time_grid_max_days).toBe(3);
    });

    it('cascading: invalid max_days=99 with nav_days=2 -> reset to 7 then clamp to 1', () => {
      const c = make({
        time_grid_max_days: 99 as unknown as 1 | 3 | 7,
        time_grid_navigation_days: 2,
      });
      validateTimeGridConfig(c);
      expect(c.time_grid_max_days).toBe(1);
    });

    it('cascading: invalid max_days=99 with nav_days=5 -> reset to 7 then clamp to 3', () => {
      const c = make({
        time_grid_max_days: 99 as unknown as 1 | 3 | 7,
        time_grid_navigation_days: 5,
      });
      validateTimeGridConfig(c);
      expect(c.time_grid_max_days).toBe(3);
    });
  });

  describe('event_min_height_px', () => {
    it('valid value 24 preserved', () => {
      const c = make({ time_grid_event_min_height_px: 24 });
      validateTimeGridConfig(c);
      expect(c.time_grid_event_min_height_px).toBe(24);
    });

    it('negative resets to default', () => {
      const c = make({ time_grid_event_min_height_px: -50 });
      validateTimeGridConfig(c);
      expect(c.time_grid_event_min_height_px).toBe(DEFAULT_CONFIG.time_grid_event_min_height_px);
    });

    it('zero resets to default', () => {
      const c = make({ time_grid_event_min_height_px: 0 });
      validateTimeGridConfig(c);
      expect(c.time_grid_event_min_height_px).toBe(DEFAULT_CONFIG.time_grid_event_min_height_px);
    });

    it('NaN resets to default', () => {
      const c = make({ time_grid_event_min_height_px: NaN });
      validateTimeGridConfig(c);
      expect(c.time_grid_event_min_height_px).toBe(DEFAULT_CONFIG.time_grid_event_min_height_px);
    });

    it('Infinity resets to default', () => {
      const c = make({ time_grid_event_min_height_px: Infinity });
      validateTimeGridConfig(c);
      expect(c.time_grid_event_min_height_px).toBe(DEFAULT_CONFIG.time_grid_event_min_height_px);
    });

    it('above 200 resets to default', () => {
      const c = make({ time_grid_event_min_height_px: 9999 });
      validateTimeGridConfig(c);
      expect(c.time_grid_event_min_height_px).toBe(DEFAULT_CONFIG.time_grid_event_min_height_px);
    });
  });

  describe('allday_bg_opacity', () => {
    it('valid 50 preserved', () => {
      const c = make({ time_grid_allday_bg_opacity: 50 });
      validateTimeGridConfig(c);
      expect(c.time_grid_allday_bg_opacity).toBe(50);
    });

    it('negative resets to default', () => {
      const c = make({ time_grid_allday_bg_opacity: -10 });
      validateTimeGridConfig(c);
      expect(c.time_grid_allday_bg_opacity).toBe(DEFAULT_CONFIG.time_grid_allday_bg_opacity);
    });

    it('above 100 resets to default', () => {
      const c = make({ time_grid_allday_bg_opacity: 200 });
      validateTimeGridConfig(c);
      expect(c.time_grid_allday_bg_opacity).toBe(DEFAULT_CONFIG.time_grid_allday_bg_opacity);
    });
  });

  describe('breakpoints', () => {
    it('valid 500/900 preserved', () => {
      const c = make({
        time_grid_breakpoint_three_day_px: 500,
        time_grid_breakpoint_seven_day_px: 900,
      });
      validateTimeGridConfig(c);
      expect(c.time_grid_breakpoint_three_day_px).toBe(500);
      expect(c.time_grid_breakpoint_seven_day_px).toBe(900);
    });

    it('negative three_day resets to default', () => {
      const c = make({ time_grid_breakpoint_three_day_px: -100 });
      validateTimeGridConfig(c);
      expect(c.time_grid_breakpoint_three_day_px).toBe(
        DEFAULT_CONFIG.time_grid_breakpoint_three_day_px,
      );
    });

    it('swapped (three > seven) resets both to defaults', () => {
      const c = make({
        time_grid_breakpoint_three_day_px: 1000,
        time_grid_breakpoint_seven_day_px: 500,
      });
      validateTimeGridConfig(c);
      expect(c.time_grid_breakpoint_three_day_px).toBe(
        DEFAULT_CONFIG.time_grid_breakpoint_three_day_px,
      );
      expect(c.time_grid_breakpoint_seven_day_px).toBe(
        DEFAULT_CONFIG.time_grid_breakpoint_seven_day_px,
      );
    });

    it('equal breakpoints reset both to defaults', () => {
      const c = make({
        time_grid_breakpoint_three_day_px: 700,
        time_grid_breakpoint_seven_day_px: 700,
      });
      validateTimeGridConfig(c);
      expect(c.time_grid_breakpoint_three_day_px).toBe(
        DEFAULT_CONFIG.time_grid_breakpoint_three_day_px,
      );
      expect(c.time_grid_breakpoint_seven_day_px).toBe(
        DEFAULT_CONFIG.time_grid_breakpoint_seven_day_px,
      );
    });
  });

  describe('show_now_line type guard', () => {
    it('boolean true preserved', () => {
      const c = make({ time_grid_show_now_line: true });
      validateTimeGridConfig(c);
      expect(c.time_grid_show_now_line).toBe(true);
    });

    it('non-boolean coerces to default', () => {
      const c = make({ time_grid_show_now_line: 'yes' as unknown as boolean });
      validateTimeGridConfig(c);
      expect(c.time_grid_show_now_line).toBe(DEFAULT_CONFIG.time_grid_show_now_line);
    });
  });
});
