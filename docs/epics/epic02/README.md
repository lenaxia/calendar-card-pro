# Epic 02 — All-Day Banners + Now-Line

**Status**: Not started
**Source issues**: [#282](https://github.com/alexpfau/calendar-card-pro/issues/282) (All-day events as banners), [#325](https://github.com/alexpfau/calendar-card-pro/issues/325) (Vertical Day View 'Live' indicator Line)
**Design doc**: [`docs/design/time-grid-view.md`](../../design/time-grid-view.md)
**Depends on**: [epic00](../epic00/README.md), [epic01](../epic01/README.md)

---

## Why this epic exists

epic00 ships a grid showing only **timed events** with empty placeholders for the all-day strip and no live time indicator. This epic fills those in:

1. **All-day banners**: events with `start.date` (no `dateTime`) render as horizontal bars above the time grid, spanning the day columns they cover. Properly clipped at the visible-window edges with `◂` / `▸` overflow indicators.
2. **Now-line**: a 2px horizontal line on today's column at the current local-time position, updated every 60s without triggering full re-renders (imperative DOM mutation).
3. **Midnight refresh**: when local-day changes (e.g., user leaves the card open overnight), the renderer's `today` cache is invalidated and re-render is triggered so the highlighting and now-line move to the new "today".

After this epic, the time-grid view feels alive — at-a-glance you know what's all-day vs timed, what's happening right now, and the visual stays correct across midnight transitions.

## In scope

- `time_grid_show_now_line: boolean` (default `true`) — already added in epic00 story0-3, used here
- `time_grid_allday_bg_opacity: number` (default `0.2`) — banner background alpha (independent of list-view's `event_background_opacity` to avoid contrast issues)
- All-day banner placement using `daysBetween` (added in epic00 story0-2):
  - `dayIdx = max(0, daysBetween(windowStart, eventStartDay))`
  - `eventEndDay = parseAllDayDate(event.end.date); eventEndDay.setDate(getDate() - 1)` (iCal exclusive → inclusive)
  - `originalSpan = daysBetween(eventStartDay, eventEndDay) + 1`
  - `clampOffset = max(0, -rawDayIdx)`
  - `numDays = min(originalSpan - clampOffset, visibleDays - dayIdx)`
  - **Skip banner if `numDays ≤ 0`** (defensive guard for malformed iCal where `start === end`)
- Banner CSS placement: `grid-column-start: <dayIdx + 2>; grid-column-end: span <numDays>`
- `◂` / `▸` overflow indicators when banner extends outside visible window
- Banner stacking order: primary by ascending start date, secondary by descending span
- Now-line element: `<div class="ccp-grid-now-line">` rendered ONLY in today's day-column when today is in `ctx.days`
- `_startNowLine`, `_stopNowLine`, `_updateNowLinePosition` private methods on host
- 60-second interval lifecycle: started in `connectedCallback`, stopped in `disconnectedCallback`, paused on `visibilitychange: 'hidden'`, resumed on `'visible'`
- **Midnight detection** runs FIRST inside `_updateNowLinePosition` (before the `lineEl` null-guard) so it fires even when today is currently out of the visible window
- `_lastRenderDay` initialized at construction time to today's local midnight (avoids spurious first-tick `requestUpdate`)
- Past-event handling for all-day banners: dimmed (not filtered) per FR-2.11 (`show_past_events: false` only filters timed past events; mirrors list-view behavior)

## Out of scope (deferred)

- Auto-scroll-to-now-line on initial render when `max_height` clips the grid → follow-up
- Stop/restart now-line interval based on whether today is currently visible (just no-op when not visible — wasteful but harmless, ~1 wasted call/min) → follow-up optimization
- Banner click handlers / event detail tooltip → follow-up
- Inline weather icons in banners → deferred per design doc §7
- Editor UI for the new fields → epic03

## User-facing outcome

After this epic:

```yaml
type: custom:calendar-card-pro
entities: [calendar.holidays, calendar.work]
view: time-grid
time_grid_show_now_line: true
time_grid_allday_bg_opacity: 0.2
```

…shows multi-day events (vacations, holidays) as horizontal banners across the top of the grid, timed events at their correct positions, and a live indicator line on today's column at the current time. Leave the card open past midnight: the highlighting moves to the new day, the now-line moves with it.

## Stories

| #                       | Title                                                     | Status      |
| ----------------------- | --------------------------------------------------------- | ----------- |
| [story2-1](story2-1.md) | All-day banner placement + overflow indicators            | Not started |
| [story2-2](story2-2.md) | Now-line rendering + 60-second imperative position update | Not started |
| [story2-3](story2-3.md) | Midnight refresh + visibility-change pause                | Not started |

## Acceptance for the epic as a whole

- All stories complete with their acceptance criteria met
- `npm run lint` clean
- `npm run build` succeeds; cumulative bundle delta through end of epic02 stays within the design's overall +25 KB budget (cap raised in worklog 0020; final budget verified at end of epic03)
- `npm test` passes (banner placement specs G-2.7a/b/c/d, now-line specs G-2.10/2.10b, midnight refresh G-midnightRefresh)
- Manual smoke test 1: multi-day all-day event renders as a banner spanning correct columns
- Manual smoke test 2: banner extending before/after the visible window shows `◂` or `▸` indicator and is clipped to the window edges
- Manual smoke test 3: now-line visible on today's column at the correct vertical position; updates every minute
- Manual smoke test 4: leave card visible across midnight → today's highlight and now-line move to the new day within ~60s
- Manual smoke test 5: switch to a different browser tab for 5 minutes → return; now-line still correctly positioned (interval was paused while hidden; resumes on visible)

## Dependencies

- epic00 (rendering module)
- epic01 (responsive `visibleDays`, navigation context — banners need `windowStart`, `visibleDays`)

## Blocks

- epic03 (editor) — exposes `time_grid_allday_bg_opacity`, `time_grid_show_now_line` in the visual editor

## Mapping to design doc FRs

| FR                     | Story    | Notes                                                             |
| ---------------------- | -------- | ----------------------------------------------------------------- |
| FR-2.7                 | story2-1 | Banner placement (full spec)                                      |
| FR-6.1, FR-6.2, FR-6.3 | story2-1 | Banner strip layout, max-height, omit-when-empty                  |
| FR-2.10                | story2-2 | Now-line rendering + imperative update                            |
| FR-11.4                | story2-2 | Interval lifecycle                                                |
| FR-11.5                | story2-3 | Midnight refresh                                                  |
| FR-2.11 (all-day past) | story2-1 | All-day past events render with `past-event` class (not filtered) |
