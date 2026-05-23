import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG, hasConfigChanged } from '../../src/config/config';
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
