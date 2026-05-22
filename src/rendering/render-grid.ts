/**
 * Time-grid rendering module for Calendar Card Pro
 *
 * Pure render function that converts events + config + injected context into a
 * Lit `TemplateResult`. Accepts `now` from `ctx`, never reads `Date.now()` or
 * the DOM. Lifecycle and DOM commit are owned by the host component.
 */

import { TemplateResult, html, nothing } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import * as Types from '../config/types';
import * as Localize from '../translations/localize';
import * as EventUtils from '../utils/events';
import * as FormatUtils from '../utils/format';
import * as Grid from '../utils/grid';
import * as Helpers from '../utils/helpers';

//-----------------------------------------------------------------------------
// PUBLIC TYPES
//-----------------------------------------------------------------------------

/**
 * Injected dependencies the host owns: clock, navigation callbacks, navigation
 * bounds. Pure renderer reads only — never mutates or schedules.
 */
export interface TimeGridContext {
  visibleDays: 1 | 3 | 7;
  offsetDays: number;
  now: Date;
  onShiftDay: (delta: -1 | 1) => void;
  onShiftWindow: (delta: -1 | 1) => void;
  onResetToToday: () => void;
  canShiftBack: boolean;
  canShiftForward: boolean;
}

//-----------------------------------------------------------------------------
// INTERNAL TYPES
//-----------------------------------------------------------------------------

interface PlacedSegment {
  event: Types.CalendarEventData;
  startMin: number;
  endMin: number;
  placement: Grid.EventPlacement;
}

type LaidOutSegment = Grid.LayoutResult<PlacedSegment>;

//-----------------------------------------------------------------------------
// CONSTANTS
//-----------------------------------------------------------------------------

const TIME_AXIS_WIDTH_PX = 60;
const TIME_VISIBLE_HEIGHT_PX = 32;
const LOCATION_VISIBLE_HEIGHT_PX = 56;

//-----------------------------------------------------------------------------
// MAIN RENDERER
//-----------------------------------------------------------------------------

/**
 * Renders the time-grid view as a Lit `TemplateResult`. Pure function of its
 * inputs: no DOM access, no clock reads, no observers.
 *
 * @param events - filtered + processed events from the host
 * @param config - merged card config
 * @param language - BCP-47-ish language code (e.g. `en`, `en-US`, `de`)
 * @param ctx - host-provided clock + navigation context
 * @param hass - optional Home Assistant object for locale detection
 */
export function renderTimeGrid(
  events: ReadonlyArray<Types.CalendarEventData>,
  config: Types.Config,
  language: string,
  ctx: TimeGridContext,
  hass?: Types.Hass | null,
): TemplateResult {
  const reference = Grid.getReferenceDate(config);
  const firstDayOfWeek = FormatUtils.getFirstDayOfWeek(config.first_day_of_week, language) as 0 | 1;
  const { start: windowStart, days } = Grid.snapToWindow(
    reference,
    ctx.offsetDays,
    ctx.visibleDays,
    firstDayOfWeek,
  );
  const windowEnd = addDays(windowStart, ctx.visibleDays);

  const use24h = resolveUse24h(config, hass);
  const slotHeightPx = Grid.SLOT_HEIGHT_PX;
  const intervalMin = config.time_grid_interval_minutes;
  const gridStartMin = config.time_grid_start_hour * 60;
  const gridEndMin = config.time_grid_end_hour * 60;
  const minHeightPx = config.time_grid_event_min_height_px;

  const todayIdx = computeTodayIdx(windowStart, ctx.now, ctx.visibleDays);

  const eventsByDay = bucketAndPlaceEvents(events, days, ctx, config, {
    windowStart,
    windowEnd,
    gridStartMin,
    gridEndMin,
    slotHeightPx,
    intervalMin,
    minHeightPx,
  });

  const hourLabels = buildHourLabels(config.time_grid_start_hour, config.time_grid_end_hour);
  const headerColumns = buildGridTemplateColumns(days.length);
  const bodyColumns = buildBodyColumns(days.length);

  const todayLabel = String(Localize.translate(language, 'time_grid_today', 'Today'));

  return html`
    <div class="ccp-grid">
      <div class="ccp-grid-nav">
        <button
          class="ccp-grid-today"
          @click=${ctx.onResetToToday}
          ?disabled=${todayIdx === 0 && ctx.offsetDays === 0}
        >
          ${todayLabel}
        </button>
        <span class="ccp-grid-range">${formatRangeLabel(days, language)}</span>
      </div>
      <div class="ccp-grid-headers" style=${styleMap({ gridTemplateColumns: headerColumns })}>
        <div class="ccp-grid-axis-spacer"></div>
        ${days.map(
          (day, i) => html`
            <div class="ccp-grid-day-header ${classMap({ today: i === todayIdx })}">
              <span class="ccp-grid-day-header-weekday">${formatWeekday(day, language)}</span>
              <span class="ccp-grid-day-header-daynum">${day.getDate()}</span>
              ${isFirstOfMonth(day)
                ? html`<span class="ccp-grid-day-header-month">${formatMonth(day, language)}</span>`
                : nothing}
            </div>
          `,
        )}
      </div>
      ${nothing}
      <div class="ccp-grid-body" style=${styleMap({ gridTemplateColumns: bodyColumns })}>
        <div class="ccp-grid-time-axis">
          ${hourLabels.map(
            (h) => html`<div class="ccp-grid-hour-label">${Grid.formatHourLabel(h, use24h)}</div>`,
          )}
        </div>
        <div
          class="ccp-grid-columns"
          style=${styleMap({ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` })}
        >
          ${days.map(
            (_day, i) => html`
              <div class="ccp-grid-day-column ${classMap({ today: i === todayIdx })}">
                ${eventsByDay[i].map((seg) => renderEventBlock(seg, config, use24h, ctx.now))}
              </div>
            `,
          )}
        </div>
      </div>
    </div>
  `;
}

//-----------------------------------------------------------------------------
// PIPELINE
//-----------------------------------------------------------------------------

interface PlacementParams {
  windowStart: Date;
  windowEnd: Date;
  gridStartMin: number;
  gridEndMin: number;
  slotHeightPx: number;
  intervalMin: number;
  minHeightPx: number;
}

function bucketAndPlaceEvents(
  events: ReadonlyArray<Types.CalendarEventData>,
  days: Date[],
  ctx: TimeGridContext,
  config: Types.Config,
  params: PlacementParams,
): LaidOutSegment[][] {
  const visible = filterToWindow(events, params.windowStart, params.windowEnd);
  const timed = visible.filter((e) => !!e.start.dateTime);
  const filtered = config.show_past_events
    ? timed
    : timed.filter((e) => !Grid.isPastEvent(e, ctx.now));

  const segments: Types.CalendarEventData[] = [];
  for (const event of filtered) {
    segments.push(...Grid.splitTimedEventByDay(event, params.windowStart, params.windowEnd));
  }

  const buckets: LaidOutSegment[][] = days.map(() => []);
  for (let i = 0; i < days.length; i++) {
    const dayStart = days[i];
    const nextDay = addDays(dayStart, 1);
    const placed: PlacedSegment[] = [];

    for (const seg of segments) {
      if (!seg.start.dateTime) continue;
      const segStart = new Date(seg.start.dateTime);
      if (segStart < dayStart || segStart >= nextDay) continue;

      const segEnd = seg.end.dateTime ? new Date(seg.end.dateTime) : null;
      if (!segEnd) continue;

      const startMin = Grid.minutesFromMidnight(segStart);
      const endMinRaw =
        segEnd.getTime() >= nextDay.getTime() ? 24 * 60 : Grid.minutesFromMidnight(segEnd);
      const placement = Grid.computeEventPlacement(
        startMin,
        endMinRaw,
        params.gridStartMin,
        params.gridEndMin,
        params.slotHeightPx,
        params.intervalMin,
        params.minHeightPx,
      );
      if (placement.outsideRange) continue;

      placed.push({ event: seg, startMin, endMin: endMinRaw, placement });
    }

    buckets[i] = Grid.layoutOverlaps(placed);
  }

  return buckets;
}

function filterToWindow(
  events: ReadonlyArray<Types.CalendarEventData>,
  windowStart: Date,
  windowEnd: Date,
): Types.CalendarEventData[] {
  const out: Types.CalendarEventData[] = [];
  for (const event of events) {
    const startMs = eventStartMs(event);
    const endMs = eventEndMs(event);
    if (startMs === null || endMs === null) continue;
    if (endMs <= windowStart.getTime()) continue;
    if (startMs >= windowEnd.getTime()) continue;
    out.push(event);
  }
  return out;
}

//-----------------------------------------------------------------------------
// EVENT BLOCK
//-----------------------------------------------------------------------------

function renderEventBlock(
  seg: LaidOutSegment,
  config: Types.Config,
  use24h: boolean,
  now: Date,
): TemplateResult {
  const { event, placement, laneIndex, laneCount } = seg;
  const widthPct = 100 / laneCount;
  const leftPct = laneIndex * widthPct;
  const showLocation =
    EventUtils.getEntitySetting(event._entityId, 'show_location', config, event) ??
    config.show_location;
  const isPast = Grid.isPastEvent(event, now);

  const startDate = event.start.dateTime ? new Date(event.start.dateTime) : null;
  const endDate = event.end.dateTime ? new Date(event.end.dateTime) : null;

  return html`
    <div
      class="ccp-grid-event ${classMap({
        'past-event': isPast,
        'clipped-top': placement.clippedTop,
        'clipped-bottom': placement.clippedBottom,
      })}"
      style=${styleMap({
        top: `${placement.topPx}px`,
        height: `${placement.heightPx}px`,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
      })}
    >
      <div class="ccp-grid-event-title">${event.summary ?? ''}</div>
      ${placement.heightPx >= TIME_VISIBLE_HEIGHT_PX && startDate && endDate
        ? html`<div class="ccp-grid-event-time">
            ${FormatUtils.formatTime(
              startDate,
              use24h,
              config.time_two_digit_hours,
            )}–${FormatUtils.formatTime(endDate, use24h, config.time_two_digit_hours)}
          </div>`
        : nothing}
      ${placement.heightPx >= LOCATION_VISIBLE_HEIGHT_PX && showLocation && event.location
        ? html`<div class="ccp-grid-event-location">${event.location}</div>`
        : nothing}
    </div>
  `;
}

//-----------------------------------------------------------------------------
// SMALL HELPERS
//-----------------------------------------------------------------------------

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function isFirstOfMonth(d: Date): boolean {
  return d.getDate() === 1;
}

function buildHourLabels(startHour: number, endHour: number): number[] {
  const out: number[] = [];
  for (let h = startHour; h < endHour; h++) out.push(h);
  return out;
}

function buildGridTemplateColumns(visibleDays: number): string {
  return `${TIME_AXIS_WIDTH_PX}px repeat(${visibleDays}, minmax(0, 1fr))`;
}

function buildBodyColumns(visibleDays: number): string {
  return `${TIME_AXIS_WIDTH_PX}px repeat(${visibleDays}, minmax(0, 1fr))`;
}

function computeTodayIdx(windowStart: Date, now: Date, visibleDays: 1 | 3 | 7): number {
  const idx = Grid.daysBetween(windowStart, Grid.startOfDay(now));
  return idx >= 0 && idx < visibleDays ? idx : -1;
}

/**
 * Mirrors `format.ts` line 70-71: explicit `true`/`false` wins; `'system'`
 * defers to the HA locale via `Helpers.getTimeFormat24h`.
 */
function resolveUse24h(config: Types.Config, hass?: Types.Hass | null): boolean {
  if (config.time_24h === 'system') {
    return Helpers.getTimeFormat24h(hass?.locale, true);
  }
  return config.time_24h === true;
}

function eventStartMs(event: Types.CalendarEventData): number | null {
  if (event.start.dateTime) return new Date(event.start.dateTime).getTime();
  if (event.start.date) return FormatUtils.parseAllDayDate(event.start.date).getTime();
  return null;
}

function eventEndMs(event: Types.CalendarEventData): number | null {
  if (event.end.dateTime) return new Date(event.end.dateTime).getTime();
  if (event.end.date) return FormatUtils.parseAllDayDate(event.end.date).getTime();
  return null;
}

function formatWeekday(day: Date, language: string): string {
  try {
    return new Intl.DateTimeFormat(language, { weekday: 'short' }).format(day);
  } catch {
    return new Intl.DateTimeFormat('en', { weekday: 'short' }).format(day);
  }
}

function formatMonth(day: Date, language: string): string {
  try {
    return new Intl.DateTimeFormat(language, { month: 'short' }).format(day);
  } catch {
    return new Intl.DateTimeFormat('en', { month: 'short' }).format(day);
  }
}

function formatRangeLabel(days: Date[], language: string): string {
  if (days.length === 0) return '';
  const first = days[0];
  const last = days[days.length - 1];
  if (days.length === 1) {
    return new Intl.DateTimeFormat(language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(first);
  }
  const fmtSame = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' });
  const fmtFull = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (first.getFullYear() === last.getFullYear()) {
    return `${fmtSame.format(first)} – ${fmtFull.format(last)}`;
  }
  return `${fmtFull.format(first)} – ${fmtFull.format(last)}`;
}
