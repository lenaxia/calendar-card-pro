import { describe, expect, it } from 'vitest';

import * as Types from '../../src/config/types';
import {
  SLOT_HEIGHT_PX,
  buildDayWindow,
  chooseVisibleDays,
  clampOffset,
  computeBannerPlacement,
  computeCardSize,
  computeEventPlacement,
  computeNowLineTop,
  computeTodayOffset,
  daysBetween,
  formatHourLabel,
  getReferenceDate,
  hasDayChanged,
  isPastEvent,
  layoutOverlaps,
  minutesFromMidnight,
  snapToWindow,
  splitTimedEventByDay,
  startOfDay,
  startOfWeek,
} from '../../src/utils/grid';

const isoLocal = (y: number, m: number, d: number, hh = 0, mm = 0): string => {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00`;
};

const timed = (startIso: string, endIso: string, extras: Partial<Types.CalendarEventData> = {}) =>
  ({
    start: { dateTime: startIso },
    end: { dateTime: endIso },
    ...extras,
  }) as Types.CalendarEventData;

const allDay = (startDate: string, endDate: string) =>
  ({
    start: { date: startDate },
    end: { date: endDate },
  }) as Types.CalendarEventData;

describe('SLOT_HEIGHT_PX', () => {
  it('exports the constant 24', () => {
    expect(SLOT_HEIGHT_PX).toBe(24);
  });
});

describe('minutesFromMidnight', () => {
  it('returns 0 for 00:00', () => {
    expect(minutesFromMidnight(new Date(2026, 4, 13, 0, 0))).toBe(0);
  });

  it('returns 810 for 13:30', () => {
    expect(minutesFromMidnight(new Date(2026, 4, 13, 13, 30))).toBe(810);
  });

  it('returns 1439 for 23:59', () => {
    expect(minutesFromMidnight(new Date(2026, 4, 13, 23, 59))).toBe(1439);
  });
});

describe('startOfDay', () => {
  it('zeros time fields and preserves Y/M/D', () => {
    const d = new Date(2026, 4, 13, 17, 42, 18, 999);
    const r = startOfDay(d);
    expect(r.getFullYear()).toBe(2026);
    expect(r.getMonth()).toBe(4);
    expect(r.getDate()).toBe(13);
    expect(r.getHours()).toBe(0);
    expect(r.getMinutes()).toBe(0);
    expect(r.getSeconds()).toBe(0);
    expect(r.getMilliseconds()).toBe(0);
  });
});

describe('daysBetween', () => {
  it('returns 0 for the same calendar day', () => {
    const a = new Date(2026, 4, 13, 9, 0);
    const b = new Date(2026, 4, 13, 18, 0);
    expect(daysBetween(a, b)).toBe(0);
  });

  it('returns 1 for consecutive days', () => {
    const a = new Date(2026, 4, 13);
    const b = new Date(2026, 4, 14);
    expect(daysBetween(a, b)).toBe(1);
  });

  it('returns 1 across DST spring-forward 2026-03-08 → 2026-03-09 (v10-F2)', () => {
    const a = new Date(2026, 2, 8);
    const b = new Date(2026, 2, 9);
    expect(daysBetween(a, b)).toBe(1);
  });

  it('returns 1 across DST fall-back 2026-11-01 → 2026-11-02', () => {
    const a = new Date(2026, 10, 1);
    const b = new Date(2026, 10, 2);
    expect(daysBetween(a, b)).toBe(1);
  });

  it('returns 1 for non-midnight inputs at 23:59 vs 00:01 next day', () => {
    const a = new Date(2026, 4, 13, 23, 59);
    const b = new Date(2026, 4, 14, 0, 1);
    expect(daysBetween(a, b)).toBe(1);
  });
});

describe('startOfWeek', () => {
  it('aligns to Sunday when firstDayOfWeek=0 (input Wed 2026-05-13)', () => {
    const r = startOfWeek(new Date(2026, 4, 13), 0);
    expect(r.getFullYear()).toBe(2026);
    expect(r.getMonth()).toBe(4);
    expect(r.getDate()).toBe(10);
    expect(r.getDay()).toBe(0);
    expect(r.getHours()).toBe(0);
  });

  it('aligns to Monday when firstDayOfWeek=1 (input Wed 2026-05-13)', () => {
    const r = startOfWeek(new Date(2026, 4, 13, 12, 30), 1);
    expect(r.getFullYear()).toBe(2026);
    expect(r.getMonth()).toBe(4);
    expect(r.getDate()).toBe(11);
    expect(r.getDay()).toBe(1);
    expect(r.getHours()).toBe(0);
  });

  it('is a no-op on an already-aligned Monday with firstDayOfWeek=1', () => {
    const r = startOfWeek(new Date(2026, 4, 11), 1);
    expect(r.getFullYear()).toBe(2026);
    expect(r.getMonth()).toBe(4);
    expect(r.getDate()).toBe(11);
    expect(r.getHours()).toBe(0);
  });
});

describe('buildDayWindow', () => {
  it('produces N=7 sequential local-midnight days starting at the given date', () => {
    const from = new Date(2026, 4, 11);
    const days = buildDayWindow(from, 7);
    expect(days).toHaveLength(7);
    days.forEach((d, i) => {
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
      expect(d.getSeconds()).toBe(0);
      expect(d.getMilliseconds()).toBe(0);
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(4);
      expect(d.getDate()).toBe(11 + i);
    });
  });
});

describe('chooseVisibleDays', () => {
  it('G-3.1b: width=0 returns cap (no-measurement fallback)', () => {
    expect(chooseVisibleDays(0, 500, 900, 7)).toBe(7);
    expect(chooseVisibleDays(0, 500, 900, 3)).toBe(3);
    expect(chooseVisibleDays(0, 500, 900, 1)).toBe(1);
  });

  it('G-3.1b: width=1 returns 1 (real measurement, very narrow)', () => {
    expect(chooseVisibleDays(1, 500, 900, 7)).toBe(1);
  });

  it('G-3.1b: width=49 returns 1', () => {
    expect(chooseVisibleDays(49, 500, 900, 7)).toBe(1);
  });

  it('G-3.1: width=499 returns 1', () => {
    expect(chooseVisibleDays(499, 500, 900, 7)).toBe(1);
  });

  it('G-3.1: width=500 returns 3', () => {
    expect(chooseVisibleDays(500, 500, 900, 7)).toBe(3);
  });

  it('G-3.1: width=899 returns 3', () => {
    expect(chooseVisibleDays(899, 500, 900, 7)).toBe(3);
  });

  it('G-3.1: width=900 returns 7', () => {
    expect(chooseVisibleDays(900, 500, 900, 7)).toBe(7);
  });

  it('G-3.1: width=2000 with cap=3 returns 3', () => {
    expect(chooseVisibleDays(2000, 500, 900, 3)).toBe(3);
  });

  it('G-3.1: width=2000 with cap=1 returns 1', () => {
    expect(chooseVisibleDays(2000, 500, 900, 1)).toBe(1);
  });
});

describe('computeEventPlacement', () => {
  it('G-2.5: in-bounds 09:30→11:00 with grid 360-1320', () => {
    const r = computeEventPlacement(570, 660, 360, 1320, 24, 30, 24);
    expect(r.topPx).toBe(168);
    expect(r.heightPx).toBe(72);
    expect(r.clippedTop).toBe(false);
    expect(r.clippedBottom).toBe(false);
    expect(r.outsideRange).toBe(false);
  });

  it('G-2.5b: minHeight clamp for 5-minute event', () => {
    const r = computeEventPlacement(600, 605, 360, 1320, 24, 30, 24);
    expect(r.heightPx).toBe(24);
    expect(r.outsideRange).toBe(false);
  });

  it('G-2.6a: clipped-top (event 04:00-07:00, grid 06:00-22:00)', () => {
    const r = computeEventPlacement(240, 420, 360, 1320, 24, 30, 24);
    expect(r.topPx).toBe(0);
    expect(r.heightPx).toBe(48);
    expect(r.clippedTop).toBe(true);
    expect(r.clippedBottom).toBe(false);
    expect(r.outsideRange).toBe(false);
  });

  it('G-2.6b: clipped-bottom (event 21:00-23:30, grid 06:00-22:00)', () => {
    const r = computeEventPlacement(1260, 1410, 360, 1320, 24, 30, 24);
    expect(r.topPx).toBe(720);
    expect(r.heightPx).toBe(48);
    expect(r.clippedBottom).toBe(true);
    expect(r.outsideRange).toBe(false);
  });

  it('G-2.6c: outside before (event 02:00-05:00, grid 06:00-22:00)', () => {
    const r = computeEventPlacement(120, 300, 360, 1320, 24, 30, 24);
    expect(r.outsideRange).toBe(true);
  });

  it('G-2.6d: outside after (event 23:00-23:45, grid 06:00-22:00)', () => {
    const r = computeEventPlacement(1380, 1425, 360, 1320, 24, 30, 24);
    expect(r.outsideRange).toBe(true);
  });

  it('G-2.6e: defensive end<start treated as outsideRange', () => {
    const r = computeEventPlacement(660, 540, 360, 1320, 24, 30, 24);
    expect(r.outsideRange).toBe(true);
  });

  it('G-2.6f: defensive end==start treated as outsideRange', () => {
    const r = computeEventPlacement(600, 600, 360, 1320, 24, 30, 24);
    expect(r.outsideRange).toBe(true);
  });
});

describe('layoutOverlaps', () => {
  it('G-2.9: cluster of three pairwise overlapping → laneCount=3, lanes 0/1/2', () => {
    const events = [
      { id: 'A', startMin: 540, endMin: 600 },
      { id: 'B', startMin: 570, endMin: 630 },
      { id: 'C', startMin: 585, endMin: 615 },
    ];
    const r = layoutOverlaps(events);
    const byId = Object.fromEntries(r.map((e) => [e.id, e]));
    expect(byId.A.laneCount).toBe(3);
    expect(byId.B.laneCount).toBe(3);
    expect(byId.C.laneCount).toBe(3);
    expect(byId.A.laneIndex).toBe(0);
    expect(byId.B.laneIndex).toBe(1);
    expect(byId.C.laneIndex).toBe(2);
  });

  it('G-2.9b: half-open intervals — A ending at 10:00 and B starting at 10:00 do not overlap', () => {
    const events = [
      { id: 'A', startMin: 540, endMin: 600 },
      { id: 'B', startMin: 600, endMin: 660 },
    ];
    const r = layoutOverlaps(events);
    const byId = Object.fromEntries(r.map((e) => [e.id, e]));
    expect(byId.A.laneCount).toBe(1);
    expect(byId.B.laneCount).toBe(1);
  });

  it('G-2.9c: disconnected clusters — each cluster reports its own laneCount', () => {
    const events = [
      { id: 'A', startMin: 540, endMin: 600 },
      { id: 'B', startMin: 570, endMin: 630 },
      { id: 'C', startMin: 840, endMin: 900 },
    ];
    const r = layoutOverlaps(events);
    const byId = Object.fromEntries(r.map((e) => [e.id, e]));
    expect(byId.A.laneCount).toBe(2);
    expect(byId.B.laneCount).toBe(2);
    expect(byId.C.laneCount).toBe(1);
  });

  it('G-2.9d: transitive overlap with lane reuse — A 09:00-09:30, B 09:15-10:00, C 09:45-10:15', () => {
    const events = [
      { id: 'A', startMin: 540, endMin: 570 },
      { id: 'B', startMin: 555, endMin: 600 },
      { id: 'C', startMin: 585, endMin: 615 },
    ];
    const r = layoutOverlaps(events);
    const byId = Object.fromEntries(r.map((e) => [e.id, e]));
    expect(byId.A.laneCount).toBe(2);
    expect(byId.B.laneCount).toBe(2);
    expect(byId.C.laneCount).toBe(2);
    expect(byId.A.laneIndex).toBe(0);
    expect(byId.B.laneIndex).toBe(1);
    expect(byId.C.laneIndex).toBe(0);
  });

  it('G-2.9e: unsorted input is sorted internally — same result as G-2.9', () => {
    const events = [
      { id: 'C', startMin: 585, endMin: 615 },
      { id: 'A', startMin: 540, endMin: 600 },
      { id: 'B', startMin: 570, endMin: 630 },
    ];
    const r = layoutOverlaps(events);
    const byId = Object.fromEntries(r.map((e) => [e.id, e]));
    expect(byId.A.laneCount).toBe(3);
    expect(byId.B.laneCount).toBe(3);
    expect(byId.C.laneCount).toBe(3);
  });
});

describe('splitTimedEventByDay', () => {
  it('G-2.8a: 2-midnight crossing yields three timed segments preserving fields', () => {
    const ev = timed(isoLocal(2026, 5, 13, 22, 0), isoLocal(2026, 5, 15, 2, 0), {
      summary: 'Meeting',
      _entityId: 'calendar.team',
    });
    const segs = splitTimedEventByDay(ev, new Date(2026, 4, 13), new Date(2026, 4, 16));
    expect(segs).toHaveLength(3);
    expect(segs[0].start.dateTime).toBe(isoLocal(2026, 5, 13, 22, 0));
    expect(segs[0].end.dateTime).toBe(isoLocal(2026, 5, 14, 0, 0));
    expect(segs[1].start.dateTime).toBe(isoLocal(2026, 5, 14, 0, 0));
    expect(segs[1].end.dateTime).toBe(isoLocal(2026, 5, 15, 0, 0));
    expect(segs[2].start.dateTime).toBe(isoLocal(2026, 5, 15, 0, 0));
    expect(segs[2].end.dateTime).toBe(isoLocal(2026, 5, 15, 2, 0));
    segs.forEach((s) => {
      expect(s.summary).toBe('Meeting');
      expect(s._entityId).toBe('calendar.team');
      expect(s.start.date).toBeUndefined();
      expect(s.end.date).toBeUndefined();
    });
  });

  it('G-2.8b: event ending exactly at midnight produces a single segment (no zero-duration second)', () => {
    const ev = timed(isoLocal(2026, 5, 13, 22, 0), isoLocal(2026, 5, 14, 0, 0));
    const segs = splitTimedEventByDay(ev, new Date(2026, 4, 13), new Date(2026, 4, 15));
    expect(segs).toHaveLength(1);
    expect(segs[0].start.dateTime).toBe(isoLocal(2026, 5, 13, 22, 0));
    expect(segs[0].end.dateTime).toBe(isoLocal(2026, 5, 14, 0, 0));
  });

  it('single-day timed event produces exactly one segment with original times', () => {
    const ev = timed(isoLocal(2026, 5, 13, 9, 0), isoLocal(2026, 5, 13, 11, 0));
    const segs = splitTimedEventByDay(ev, new Date(2026, 4, 13), new Date(2026, 4, 14));
    expect(segs).toHaveLength(1);
    expect(segs[0].start.dateTime).toBe(isoLocal(2026, 5, 13, 9, 0));
    expect(segs[0].end.dateTime).toBe(isoLocal(2026, 5, 13, 11, 0));
  });
});

describe('getReferenceDate', () => {
  it('returns today at local midnight when start_date is missing', () => {
    const r = getReferenceDate({ days_to_show: 3 });
    const today = new Date();
    expect(r.getFullYear()).toBe(today.getFullYear());
    expect(r.getMonth()).toBe(today.getMonth());
    expect(r.getDate()).toBe(today.getDate());
    expect(r.getHours()).toBe(0);
    expect(r.getMinutes()).toBe(0);
  });

  it('returns today at local midnight when start_date is empty string', () => {
    const r = getReferenceDate({ start_date: '   ', days_to_show: 3 });
    const today = new Date();
    expect(r.getFullYear()).toBe(today.getFullYear());
    expect(r.getMonth()).toBe(today.getMonth());
    expect(r.getDate()).toBe(today.getDate());
  });

  it('parses YYYY-MM-DD start_date', () => {
    const r = getReferenceDate({ start_date: '2026-05-13', days_to_show: 7 });
    expect(r.getFullYear()).toBe(2026);
    expect(r.getMonth()).toBe(4);
    expect(r.getDate()).toBe(13);
    expect(r.getHours()).toBe(0);
  });

  it('parses relative today+5 / today-3 against today', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const plus5 = getReferenceDate({ start_date: 'today+5', days_to_show: 7 });
    const expectedPlus = new Date(today);
    expectedPlus.setDate(expectedPlus.getDate() + 5);
    expect(plus5.getTime()).toBe(expectedPlus.getTime());

    const minus3 = getReferenceDate({ start_date: 'today-3', days_to_show: 7 });
    const expectedMinus = new Date(today);
    expectedMinus.setDate(expectedMinus.getDate() - 3);
    expect(minus3.getTime()).toBe(expectedMinus.getTime());
  });
});

describe('isPastEvent', () => {
  it('G-isPast: timed event ending before now is past', () => {
    const now = new Date(2026, 4, 13, 12, 0);
    const ev = timed(isoLocal(2026, 5, 13, 9, 0), isoLocal(2026, 5, 13, 11, 0));
    expect(isPastEvent(ev, now)).toBe(true);
  });

  it('G-isPast: timed event ending after now is not past', () => {
    const now = new Date(2026, 4, 13, 12, 0);
    const ev = timed(isoLocal(2026, 5, 13, 13, 0), isoLocal(2026, 5, 13, 14, 0));
    expect(isPastEvent(ev, now)).toBe(false);
  });

  it('G-isPast: all-day event yesterday is past (exclusive-end-adjustment)', () => {
    const now = new Date(2026, 4, 13, 12, 0);
    const ev = allDay('2026-05-12', '2026-05-13');
    expect(isPastEvent(ev, now)).toBe(true);
  });

  it('G-isPast: all-day event today (or future) is not past', () => {
    const now = new Date(2026, 4, 13, 12, 0);
    const ev = allDay('2026-05-13', '2026-05-14');
    expect(isPastEvent(ev, now)).toBe(false);
  });
});

describe('formatHourLabel', () => {
  it('G-hourLabel: formatHourLabel(0, true) === "0"', () => {
    expect(formatHourLabel(0, true)).toBe('0');
  });

  it('G-hourLabel: formatHourLabel(13, true) === "13"', () => {
    expect(formatHourLabel(13, true)).toBe('13');
  });

  it('G-hourLabel: formatHourLabel(0, false) === "12 AM"', () => {
    expect(formatHourLabel(0, false)).toBe('12 AM');
  });

  it('G-hourLabel: formatHourLabel(11, false) === "11 AM"', () => {
    expect(formatHourLabel(11, false)).toBe('11 AM');
  });

  it('G-hourLabel: formatHourLabel(12, false) === "12 PM"', () => {
    expect(formatHourLabel(12, false)).toBe('12 PM');
  });

  it('G-hourLabel: formatHourLabel(23, false) === "11 PM"', () => {
    expect(formatHourLabel(23, false)).toBe('11 PM');
  });
});

describe('snapToWindow', () => {
  const expectMidnight = (d: Date): void => {
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  };

  it('G-5.1: aligns Wed reference to Mon when firstDayOfWeek=1, dayCount=7', () => {
    const ref = new Date(2026, 4, 13);
    const { start, days } = snapToWindow(ref, 0, 7, 1);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(4);
    expect(start.getDate()).toBe(11);
    expectMidnight(start);
    expect(days).toHaveLength(7);
    days.forEach(expectMidnight);
  });

  it('G-5.1b: already-aligned Mon reference is unchanged when firstDayOfWeek=1, dayCount=7', () => {
    const ref = new Date(2026, 4, 11);
    const { start } = snapToWindow(ref, 0, 7, 1);
    expect(start.getDate()).toBe(11);
    expect(start.getMonth()).toBe(4);
    expect(start.getFullYear()).toBe(2026);
  });

  it('G-5.2: rolling 3-day window applies offset without week alignment', () => {
    const ref = new Date(2026, 4, 13);
    const { start, days } = snapToWindow(ref, 2, 3, 1);
    expect(start.getDate()).toBe(15);
    expect(start.getMonth()).toBe(4);
    expectMidnight(start);
    expect(days).toHaveLength(3);
    expect(days[2].getDate()).toBe(17);
  });

  it('Sunday-aligned 7-day window: Wed reference snaps to preceding Sunday', () => {
    const ref = new Date(2026, 4, 13);
    const { start, days } = snapToWindow(ref, 0, 7, 0);
    expect(start.getDate()).toBe(10);
    expect(start.getMonth()).toBe(4);
    expect(days[0].getDay()).toBe(0);
  });

  it('1-day window: dayCount=1 yields a window starting at the reference', () => {
    const ref = new Date(2026, 4, 13);
    const { start, days } = snapToWindow(ref, 0, 1, 1);
    expect(start.getDate()).toBe(13);
    expect(days).toHaveLength(1);
  });

  it('Negative offset: rolling 3-day window starts one day before reference', () => {
    const ref = new Date(2026, 4, 13);
    const { start, days } = snapToWindow(ref, -1, 3, 1);
    expect(start.getDate()).toBe(12);
    expect(days).toHaveLength(3);
    expect(days[2].getDate()).toBe(14);
  });
});

describe('computeCardSize', () => {
  const baseGridConfig = {
    view: 'time-grid' as const,
    time_grid_start_hour: 6,
    time_grid_end_hour: 22,
    time_grid_interval_minutes: 30 as const,
    max_height: 'none',
  };

  it('G-getCardSize: list view returns 1', () => {
    expect(computeCardSize({ ...baseGridConfig, view: 'list' })).toBe(1);
  });

  it('G-getCardSize: default 06-22 / interval 30 returns 17', () => {
    expect(computeCardSize(baseGridConfig)).toBe(17);
  });

  it('G-getCardSize: max_height=400px clamps to 8', () => {
    expect(computeCardSize({ ...baseGridConfig, max_height: '400px' })).toBe(8);
  });

  it('G-getCardSize: full-day 00-24 / interval 60 returns 14', () => {
    expect(
      computeCardSize({
        ...baseGridConfig,
        time_grid_start_hour: 0,
        time_grid_end_hour: 24,
        time_grid_interval_minutes: 60,
      }),
    ).toBe(14);
  });
});

describe('clampOffset', () => {
  it('G-4.4: clampOffset(21, +7, 21) returns 21 (max-clamp at upper bound)', () => {
    expect(clampOffset(21, 7, 21)).toBe(21);
  });

  it('clampOffset(21, -7, 21) returns 14 (within range)', () => {
    expect(clampOffset(21, -7, 21)).toBe(14);
  });

  it('clampOffset(21, +1, 21) returns 21 (already at max, no-op)', () => {
    expect(clampOffset(21, 1, 21)).toBe(21);
  });

  it('clampOffset(0, -1, 21) returns 0 (lower-clamp)', () => {
    expect(clampOffset(0, -1, 21)).toBe(0);
  });

  it('clampOffset(10, 5, 21) returns 15 (within range)', () => {
    expect(clampOffset(10, 5, 21)).toBe(15);
  });
});

describe('computeTodayOffset', () => {
  it('G-Today: start_date="-7" puts today at offset 7', () => {
    const reference = new Date(2026, 4, 6);
    const today = new Date(2026, 4, 13);
    expect(computeTodayOffset(reference, today, 7, 28)).toBe(7);
  });

  it('reference === today returns 0 (default config)', () => {
    const today = new Date(2026, 4, 13);
    expect(computeTodayOffset(today, today, 7, 28)).toBe(0);
  });

  it('future start_date: today before reference clamps to 0', () => {
    const reference = new Date(2026, 4, 18);
    const today = new Date(2026, 4, 13);
    expect(computeTodayOffset(reference, today, 7, 28)).toBe(0);
  });

  it('clamps at maxOffset when navigationDays is small', () => {
    const reference = new Date(2026, 4, 1);
    const today = new Date(2026, 4, 30);
    expect(computeTodayOffset(reference, today, 7, 14)).toBe(7);
  });

  it('respects visibleDays (1-day mode caps at navigationDays - 1)', () => {
    const reference = new Date(2026, 4, 1);
    const today = new Date(2026, 4, 30);
    expect(computeTodayOffset(reference, today, 1, 14)).toBe(13);
  });
});

describe('computeBannerPlacement', () => {
  const windowStart = new Date(2026, 4, 11);

  it('G-2.7a: places a banner fully inside the window with no overflow flags', () => {
    const eventStart = new Date(2026, 4, 13);
    const eventEnd = new Date(2026, 4, 16);
    const placement = computeBannerPlacement(eventStart, eventEnd, windowStart, 7);
    expect(placement).toEqual({
      dayIdx: 2,
      numDays: 4,
      startedBefore: false,
      continuesAfter: false,
      visible: true,
    });
  });

  it('G-2.7b: clamps a banner that started before the window and sets startedBefore', () => {
    const eventStart = new Date(2026, 4, 9);
    const eventEnd = new Date(2026, 4, 13);
    const placement = computeBannerPlacement(eventStart, eventEnd, windowStart, 7);
    expect(placement).toEqual({
      dayIdx: 0,
      numDays: 3,
      startedBefore: true,
      continuesAfter: false,
      visible: true,
    });
  });

  it('G-2.7c: clamps a banner that continues after the window and sets continuesAfter', () => {
    const eventStart = new Date(2026, 4, 16);
    const eventEnd = new Date(2026, 4, 20);
    const placement = computeBannerPlacement(eventStart, eventEnd, windowStart, 7);
    expect(placement).toEqual({
      dayIdx: 5,
      numDays: 2,
      startedBefore: false,
      continuesAfter: true,
      visible: true,
    });
  });

  it('G-2.7d: spans the entire window and sets both overflow flags', () => {
    const eventStart = new Date(2026, 4, 9);
    const eventEnd = new Date(2026, 4, 20);
    const placement = computeBannerPlacement(eventStart, eventEnd, windowStart, 7);
    expect(placement).toEqual({
      dayIdx: 0,
      numDays: 7,
      startedBefore: true,
      continuesAfter: true,
      visible: true,
    });
  });

  it('returns visible=false when the event lies entirely outside the window', () => {
    const eventStart = new Date(2026, 4, 1);
    const eventEnd = new Date(2026, 4, 5);
    const placement = computeBannerPlacement(eventStart, eventEnd, windowStart, 7);
    expect(placement.visible).toBe(false);
    expect(placement.numDays).toBe(0);
  });
});

describe('computeNowLineTop', () => {
  it('G-2.10: 14:30 with 06:00-22:00 grid, slot=24, interval=30 returns 408', () => {
    expect(computeNowLineTop(870, 360, 1320, 24, 30)).toBe(408);
  });

  it('G-2.10b: 23:30 outside 06:00-22:00 grid returns null', () => {
    expect(computeNowLineTop(1410, 360, 1320, 24, 30)).toBeNull();
  });

  it('exact gridStartMin: 06:00 returns 0', () => {
    expect(computeNowLineTop(360, 360, 1320, 24, 30)).toBe(0);
  });

  it('exactly at gridEndMin: 22:00 returns null (>= upper bound)', () => {
    expect(computeNowLineTop(1320, 360, 1320, 24, 30)).toBeNull();
  });

  it('before gridStartMin: 05:30 returns null', () => {
    expect(computeNowLineTop(330, 360, 1320, 24, 30)).toBeNull();
  });
});

describe('hasDayChanged', () => {
  it('G-midnightRefresh: same day returns false', () => {
    const lastRender = startOfDay(new Date(2026, 4, 13)).getTime();
    const now = new Date(2026, 4, 13, 23, 59, 0);
    expect(hasDayChanged(lastRender, now)).toBe(false);
  });

  it('G-midnightRefresh: midnight rollover returns true', () => {
    const lastRender = startOfDay(new Date(2026, 4, 13)).getTime();
    const now = new Date(2026, 4, 14, 0, 0, 30);
    expect(hasDayChanged(lastRender, now)).toBe(true);
  });

  it('arbitrary later day returns true', () => {
    const lastRender = startOfDay(new Date(2026, 4, 13)).getTime();
    const now = new Date(2026, 4, 20, 12, 0, 0);
    expect(hasDayChanged(lastRender, now)).toBe(true);
  });

  it('earlier day returns true (clock-rewind defensive)', () => {
    const lastRender = startOfDay(new Date(2026, 4, 13)).getTime();
    const now = new Date(2026, 4, 12, 23, 0, 0);
    expect(hasDayChanged(lastRender, now)).toBe(true);
  });
});
