/**
 * Pure helpers for the time-grid view of Calendar Card Pro
 *
 * Date math, layout/overlap math, event splitting, and label formatting.
 * No imports from Lit, DOM, HA, or events.ts beyond the public getTimeWindow.
 * All functions operate in the local timezone unless otherwise noted.
 */

import { getTimeWindow } from './events';
import { parseAllDayDate } from './format';
import * as Types from '../config/types';

//-----------------------------------------------------------------------------
// CONSTANTS
//-----------------------------------------------------------------------------

/** Vertical pixels per 30-minute slot in the time-grid view. */
export const SLOT_HEIGHT_PX = 24;

//-----------------------------------------------------------------------------
// PLACEMENT / LAYOUT TYPES
//-----------------------------------------------------------------------------

/**
 * Result of placing a timed event into the grid.
 * - `outsideRange` true when the event has no overlap with the visible hour band
 *   (or is malformed, end <= start). Other fields are 0 in that case.
 * - `clippedTop`/`clippedBottom` indicate the event extends past the visible band.
 */
export interface EventPlacement {
  topPx: number;
  heightPx: number;
  clippedTop: boolean;
  clippedBottom: boolean;
  outsideRange: boolean;
}

/**
 * Half-open interval used by layoutOverlaps. Caller-defined extra fields are
 * preserved on the output via intersection.
 */
export interface OverlapInput {
  startMin: number;
  endMin: number;
}

/** Result of layoutOverlaps: original record plus assigned lane index/count. */
export type LayoutResult<T extends OverlapInput> = T & {
  laneIndex: number;
  laneCount: number;
};

//-----------------------------------------------------------------------------
// DATE / TIME HELPERS
//-----------------------------------------------------------------------------

/**
 * Minutes elapsed since local midnight for the given Date.
 *
 * @param d - Local-time Date
 * @returns integer in [0, 1440)
 */
export function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Returns a new Date set to local 00:00:00.000 on the same calendar day.
 *
 * @param d - any local-time Date
 * @returns Date at local midnight
 */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Whole-day difference (b - a), using local midnight normalization.
 *
 * @param a - earlier Date (any time)
 * @param b - later Date (any time)
 * @returns integer day count; can be negative if b < a
 */
export function daysBetween(a: Date, b: Date): number {
  const sa = startOfDay(a).getTime();
  const sb = startOfDay(b).getTime();
  // Round (not floor) handles ±1h DST: spring-forward gives a 23h day; floor → 0 instead of 1.
  return Math.round((sb - sa) / 86_400_000);
}

/**
 * Local midnight of the week containing `d`, aligned to `firstDayOfWeek`.
 *
 * @param d - any local-time Date
 * @param firstDayOfWeek - 0 (Sunday) or 1 (Monday)
 * @returns Date at local midnight
 */
export function startOfWeek(d: Date, firstDayOfWeek: 0 | 1): Date {
  const base = startOfDay(d);
  const offset = (base.getDay() - firstDayOfWeek + 7) % 7;
  base.setDate(base.getDate() - offset);
  return base;
}

/**
 * Builds an array of `dayCount` consecutive local-midnight Date entries
 * starting at `from`.
 *
 * @param from - first day (will be normalized to local midnight)
 * @param dayCount - number of days to emit
 * @returns array of Date, each at local midnight
 */
export function buildDayWindow(from: Date, dayCount: number): Date[] {
  const start = startOfDay(from);
  const out: Date[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

/**
 * Snaps a reference Date and offset to a coherent window of `dayCount`
 * consecutive local-midnight Dates. For `dayCount === 7`, the window's start
 * is week-aligned to `firstDayOfWeek`. For other dayCount values, the window
 * is a rolling range starting at `reference + offsetDays`.
 *
 * @param reference - base date; normalized to local midnight
 * @param offsetDays - signed day offset added to reference
 * @param dayCount - 1, 3, or 7 columns
 * @param firstDayOfWeek - 0 (Sunday) or 1 (Monday); only used for dayCount === 7
 * @returns local-midnight `start` and array of `dayCount` local-midnight Dates
 */
export function snapToWindow(
  reference: Date,
  offsetDays: number,
  dayCount: 1 | 3 | 7,
  firstDayOfWeek: 0 | 1,
): { start: Date; days: Date[] } {
  const base = startOfDay(reference);
  base.setDate(base.getDate() + offsetDays);
  const start = dayCount === 7 ? startOfWeek(base, firstDayOfWeek) : base;
  return { start, days: buildDayWindow(start, dayCount) };
}

//-----------------------------------------------------------------------------
// RESPONSIVE LAYOUT
//-----------------------------------------------------------------------------

/**
 * Clamps a navigation offset (current + delta) to the valid range [0, max].
 * Pure helper extracted from the host's `_shiftDays` so the math is testable.
 *
 * @param current - current `viewOffsetDays`
 * @param delta - signed shift in days (positive = forward, negative = backward)
 * @param max - upper bound, typically `time_grid_navigation_days - visibleDays`
 */
export function clampOffset(current: number, delta: number, max: number): number {
  return Math.max(0, Math.min(max, current + delta));
}

/**
 * Picks 1, 3, or 7 visible days based on container width and breakpoints,
 * applying `cap` as the maximum. A `widthPx === 0` input is the
 * pre-measurement fallback and returns `cap` directly.
 *
 * @param widthPx - measured host width in pixels (0 = unmeasured)
 * @param bpThreeDayPx - minimum width to consider 3-day layout
 * @param bpSevenDayPx - minimum width to consider 7-day layout
 * @param cap - configured upper bound (1, 3, or 7)
 */
export function chooseVisibleDays(
  widthPx: number,
  bpThreeDayPx: number,
  bpSevenDayPx: number,
  cap: 1 | 3 | 7,
): 1 | 3 | 7 {
  if (widthPx === 0) return cap;
  if (widthPx >= bpSevenDayPx && cap >= 7) return 7;
  if (widthPx >= bpThreeDayPx && cap >= 3) return 3;
  return 1;
}

//-----------------------------------------------------------------------------
// EVENT PLACEMENT
//-----------------------------------------------------------------------------

/**
 * Computes pixel placement of a timed event within the grid hour-band.
 * Returns `outsideRange: true` for malformed (end <= start) or fully-out-of-band
 * inputs. Clamps top/bottom to the band; height is clamped before applying
 * `minHeightPx`, so a clamped event never visually exceeds the band.
 *
 * @param startMin - event start, minutes from local midnight
 * @param endMin - event end, minutes from local midnight (half-open)
 * @param gridStartMin - grid top edge, minutes from local midnight
 * @param gridEndMin - grid bottom edge, minutes from local midnight
 * @param slotHeightPx - pixels per `intervalMin`
 * @param intervalMin - minutes per slot (typically 30)
 * @param minHeightPx - minimum visual height for very short events
 */
export function computeEventPlacement(
  startMin: number,
  endMin: number,
  gridStartMin: number,
  gridEndMin: number,
  slotHeightPx: number,
  intervalMin: number,
  minHeightPx: number,
): EventPlacement {
  const empty: EventPlacement = {
    topPx: 0,
    heightPx: 0,
    clippedTop: false,
    clippedBottom: false,
    outsideRange: true,
  };
  if (endMin <= startMin) return empty;
  if (endMin <= gridStartMin) return empty;
  if (startMin >= gridEndMin) return empty;

  const clippedTop = startMin < gridStartMin;
  const clippedBottom = endMin > gridEndMin;
  const visibleStart = Math.max(startMin, gridStartMin);
  const visibleEnd = Math.min(endMin, gridEndMin);
  const pxPerMin = slotHeightPx / intervalMin;

  const topPx = (visibleStart - gridStartMin) * pxPerMin;
  const rawHeight = (visibleEnd - visibleStart) * pxPerMin;
  const bandHeight = (gridEndMin - gridStartMin) * pxPerMin;
  const maxHeight = bandHeight - topPx;
  const heightPx = Math.min(maxHeight, Math.max(rawHeight, minHeightPx));

  return { topPx, heightPx, clippedTop, clippedBottom, outsideRange: false };
}

//-----------------------------------------------------------------------------
// OVERLAP LAYOUT
//-----------------------------------------------------------------------------

/**
 * Cluster-based packing of overlapping events. Sorts internally by `startMin`
 * ascending, then walks events forming clusters of pairwise-transitive
 * overlap. Within a cluster, lanes are assigned greedily (lowest free index);
 * `laneCount` is the cluster's max simultaneous overlap. Half-open intervals:
 * an event ending at T does not overlap one starting at T.
 *
 * @param events - array of records carrying `startMin`/`endMin`
 * @returns same records with `laneIndex` and `laneCount` attached, in sorted order
 */
export function layoutOverlaps<T extends OverlapInput>(events: T[]): LayoutResult<T>[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin);
  const out: LayoutResult<T>[] = [];

  let clusterStartIdx = 0;
  let clusterMaxEnd = -Infinity;
  const clusterLaneEnds: number[] = [];
  const clusterLaneIdxs: number[] = [];

  const flush = (uptoExclusive: number): void => {
    const laneCount = clusterLaneEnds.length;
    for (let i = clusterStartIdx; i < uptoExclusive; i++) {
      out[i] = { ...sorted[i], laneIndex: clusterLaneIdxs[i - clusterStartIdx], laneCount };
    }
  };

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    if (ev.startMin >= clusterMaxEnd) {
      flush(i);
      clusterStartIdx = i;
      clusterMaxEnd = ev.endMin;
      clusterLaneEnds.length = 0;
      clusterLaneIdxs.length = 0;
    } else if (ev.endMin > clusterMaxEnd) {
      clusterMaxEnd = ev.endMin;
    }

    let lane = -1;
    for (let l = 0; l < clusterLaneEnds.length; l++) {
      if (clusterLaneEnds[l] <= ev.startMin) {
        lane = l;
        break;
      }
    }
    if (lane === -1) {
      lane = clusterLaneEnds.length;
      clusterLaneEnds.push(ev.endMin);
    } else {
      clusterLaneEnds[lane] = ev.endMin;
    }
    clusterLaneIdxs.push(lane);
  }
  flush(sorted.length);

  return out;
}

//-----------------------------------------------------------------------------
// EVENT SPLITTING
//-----------------------------------------------------------------------------

/**
 * Splits a single timed event by local-day boundaries within `[windowStart, windowEnd)`.
 * Each returned segment preserves all fields of the original (summary, location,
 * description, _entityId, _matchedConfig, _entityLabel, …) via shallow spread,
 * replacing only `start` and `end`. Zero-duration segments (e.g. an event ending
 * exactly at midnight produces no second-day segment) are dropped.
 *
 * @param event - timed event with start.dateTime and end.dateTime as local ISO
 * @param windowStart - inclusive local-midnight lower bound
 * @param windowEnd - exclusive local-midnight upper bound
 */
export function splitTimedEventByDay(
  event: Types.CalendarEventData,
  windowStart: Date,
  windowEnd: Date,
): Types.CalendarEventData[] {
  if (!event.start.dateTime || !event.end.dateTime) return [];

  const evStart = new Date(event.start.dateTime);
  const evEnd = new Date(event.end.dateTime);
  if (evEnd <= evStart) return [];

  const lower = startOfDay(windowStart);
  const upper = startOfDay(windowEnd);
  const out: Types.CalendarEventData[] = [];

  let cursorDay = startOfDay(evStart);
  if (cursorDay < lower) cursorDay = new Date(lower);

  while (cursorDay < upper) {
    const nextDay = new Date(cursorDay);
    nextDay.setDate(nextDay.getDate() + 1);

    const segStart = cursorDay < evStart ? evStart : cursorDay;
    const segEnd = nextDay < evEnd ? nextDay : evEnd;

    if (segEnd > segStart) {
      out.push({
        ...event,
        start: { dateTime: toLocalIso(segStart) },
        end: { dateTime: toLocalIso(segEnd) },
      });
    }

    if (nextDay >= evEnd) break;
    cursorDay = nextDay;
  }

  return out;
}

//-----------------------------------------------------------------------------
// REFERENCE DATE / PAST / LABELS
//-----------------------------------------------------------------------------

/**
 * Computes the reference start date for the time-grid view. Replicates the
 * behavior of the private `getStartDateReference` in events.ts via the public
 * getTimeWindow API. Returns local midnight.
 *
 * @param config - subset of Config with `start_date` and `days_to_show`
 */
export function getReferenceDate(config: Pick<Types.Config, 'start_date' | 'days_to_show'>): Date {
  if (config.start_date && config.start_date.trim() !== '') {
    return getTimeWindow(config.days_to_show, config.start_date).start;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Whether `event` is past relative to `now`. Replicates the list-view semantics
 * in render.ts: timed events compare end-time strictly after `now`; all-day
 * events apply iCal exclusive-end-adjustment (subtract one day) and compare
 * `today > endDate` at local-midnight granularity.
 */
export function isPastEvent(event: Types.CalendarEventData, now: Date): boolean {
  const isAllDay = !event.start.dateTime;

  if (isAllDay) {
    if (!event.end.date) return false;
    const endDate = parseAllDayDate(event.end.date);
    endDate.setDate(endDate.getDate() - 1);
    const today = startOfDay(now);
    return today > endDate;
  }

  if (!event.end.dateTime) return false;
  const endDateTime = new Date(event.end.dateTime);
  return now > endDateTime;
}

/**
 * Hour axis label. Pure hour-only formatting (no minutes — that would waste
 * axis width). 24-hour mode emits the hour as a string; 12-hour mode emits
 * "12 AM", "1 AM"…"12 PM", "1 PM"…"11 PM".
 */
export function formatHourLabel(hour: number, use24h: boolean): string {
  if (use24h) return String(hour);
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

/**
 * Approximate card size in 50px-row units for Home Assistant's masonry view.
 * Returns 1 for the list view (matches HA's documented default when the
 * method is not defined). For the time-grid view, sums the visible-band
 * pixel height (computed from start/end hour, interval, and SLOT_HEIGHT_PX)
 * plus a small chrome allowance for the nav bar and day headers, then
 * clamps to `max_height` when it is a px value.
 */
export function computeCardSize(
  config: Pick<
    Types.Config,
    | 'view'
    | 'time_grid_start_hour'
    | 'time_grid_end_hour'
    | 'time_grid_interval_minutes'
    | 'max_height'
  >,
): number {
  if (config.view !== 'time-grid') return 1;

  const slotsPerHour = 60 / config.time_grid_interval_minutes;
  const gridPx =
    (config.time_grid_end_hour - config.time_grid_start_hour) * slotsPerHour * SLOT_HEIGHT_PX;
  const chromePx = 80;
  let totalPx = gridPx + chromePx;

  const mh = config.max_height;
  if (mh && mh !== 'none' && mh.endsWith('px')) {
    const mhPx = parseFloat(mh);
    if (!isNaN(mhPx)) totalPx = Math.min(totalPx, mhPx);
  }

  return Math.max(1, Math.ceil(totalPx / 50));
}

//-----------------------------------------------------------------------------
// INTERNAL HELPERS
//-----------------------------------------------------------------------------

/**
 * Local ISO string with no timezone suffix, matching the input format produced
 * by HA when `dateTime` lacks an explicit zone (e.g. "2026-05-13T22:00:00").
 */
function toLocalIso(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`;
}
