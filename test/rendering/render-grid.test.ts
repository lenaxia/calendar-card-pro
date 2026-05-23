import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG } from '../../src/config/config';
import * as Types from '../../src/config/types';
import { buildAllDayBanners } from '../../src/rendering/render-grid';

const allDay = (
  startDate: string,
  endDate: string,
  extras: Partial<Types.CalendarEventData> = {},
): Types.CalendarEventData =>
  ({
    start: { date: startDate },
    end: { date: endDate },
    ...extras,
  }) as Types.CalendarEventData;

const makeConfig = (overrides: Partial<Types.Config> = {}): Types.Config =>
  ({ ...DEFAULT_CONFIG, ...overrides }) as Types.Config;

describe('buildAllDayBanners (H-4: show_past_events filter for all-day banners, E-10)', () => {
  // Window: May 11..17 (Mon..Sun, 7 days)
  const windowStart = new Date(2026, 4, 11);
  const visibleDays = 7 as const;
  const now = new Date(2026, 4, 13, 12, 0);

  it('H-4a: when show_past_events=true, past banners are kept (parity with old behavior)', () => {
    // Banner May 11..12 (end-exclusive May 13) → past relative to May 13.
    const event = allDay('2026-05-11', '2026-05-13', { summary: 'past banner' });
    const config = makeConfig({ show_past_events: true });
    const banners = buildAllDayBanners([event], windowStart, visibleDays, config, now);
    expect(banners.length).toBe(1);
    expect(banners[0].event.summary).toBe('past banner');
  });

  it('H-4b: when show_past_events=false, past banners are filtered out (E-10 fix)', () => {
    const event = allDay('2026-05-11', '2026-05-13', { summary: 'past banner' });
    const config = makeConfig({ show_past_events: false });
    const banners = buildAllDayBanners([event], windowStart, visibleDays, config, now);
    expect(banners.length).toBe(0);
  });

  it('H-4c: when show_past_events=false, current/future banners are kept', () => {
    // Ends May 13 (inclusive May 12) is past. Ends May 14 (inclusive May 13 = today) is current.
    const past = allDay('2026-05-11', '2026-05-13', { summary: 'past' });
    const today = allDay('2026-05-12', '2026-05-14', { summary: 'today' });
    const future = allDay('2026-05-15', '2026-05-17', { summary: 'future' });
    const config = makeConfig({ show_past_events: false });
    const banners = buildAllDayBanners(
      [past, today, future],
      windowStart,
      visibleDays,
      config,
      now,
    );
    const summaries = banners.map((b) => b.event.summary).sort();
    expect(summaries).toEqual(['future', 'today']);
  });

  it('H-4d: a banner ending exactly today (inclusive) is NOT past', () => {
    // end.date "2026-05-14" → inclusive end May 13 = today; should NOT be filtered.
    const event = allDay('2026-05-11', '2026-05-14', { summary: 'ends today' });
    const config = makeConfig({ show_past_events: false });
    const banners = buildAllDayBanners([event], windowStart, visibleDays, config, now);
    expect(banners.length).toBe(1);
  });

  it('H-4e: filter is applied symmetrically — same predicate as timed events use isPastEvent', () => {
    // Mixed input: only past banner is filtered; non-banner (timed) events are
    // ignored by buildAllDayBanners regardless of show_past_events because the
    // function only emits banners. This guards against the prior inconsistency
    // where timed events filtered past but banners did not.
    const past = allDay('2026-05-08', '2026-05-12', { summary: 'past banner' });
    const ongoing = allDay('2026-05-12', '2026-05-15', { summary: 'ongoing banner' });
    const config = makeConfig({ show_past_events: false });
    const banners = buildAllDayBanners([past, ongoing], windowStart, visibleDays, config, now);
    expect(banners.length).toBe(1);
    expect(banners[0].event.summary).toBe('ongoing banner');
  });
});
