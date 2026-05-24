# Epic 01 — Responsive Columns + Navigation

**Status**: Not started
**Source issues**: [alexpfau/calendar-card-pro#300](https://github.com/alexpfau/calendar-card-pro/issues/300), [#185](https://github.com/alexpfau/calendar-card-pro/issues/185) (Date Range Selector)
**Design doc**: [`docs/design/time-grid-view.md`](../../design/time-grid-view.md)
**Depends on**: [epic00](../epic00/README.md)

---

## Why this epic exists

epic00 ships a 7-day fixed grid with no navigation. Real users have varying card widths (mobile sidebar, desktop panel, multi-column dashboard) and need to navigate forward/backward through dates. This epic adds:

1. **Responsive column count**: card observes its own width via `ResizeObserver` and switches between 1, 3, and 7 day columns based on configurable breakpoints
2. **Navigation buttons**: `<` `>` shift by 1 day; `<<` `>>` shift by N days (current visible window); `Today` resets to today's offset within the fetch window
3. **Window alignment**: 7-day mode is week-aligned (snaps to Mon/Sun); 1- and 3-day modes are rolling
4. **Decoupled fetch window**: new `time_grid_navigation_days` (default 28) lets users navigate ~4 weeks without re-fetching, while leaving list-view's `days_to_show` untouched

After this epic, the time-grid view feels like a real calendar app, not a static layout.

## In scope

- `time_grid_max_days: 1 | 3 | 7` (default 7) cap on responsive N
- `time_grid_breakpoint_three_day_px: number` (default 500)
- `time_grid_breakpoint_seven_day_px: number` (default 900)
- `time_grid_navigation_days: number` (default 28)
- `chooseVisibleDays`, `snapToWindow` helpers (already specced in epic00 story0-2 — this epic just _uses_ them)
- `ResizeObserver` lifecycle in host (`connectedCallback`, `disconnectedCallback`, `_syncObserver`)
- Initial width measurement via `this.offsetWidth` in `connectedCallback` (forces synchronous layout pass — `firstUpdated` is too late)
- Width=0 fallback returns `cap` (no-measurement guard, NOT real-tiny-width-uses-cap)
- Navigation header markup with conditional button visibility:
  - N=1: `<` Today `>`
  - N=3: `<<` `<` Today `>` `>>`
  - N=7: `<<` Today `>>` (single-step buttons hidden — week boundary snap makes them no-ops)
- Navigation handlers `_shiftDays`, `_maxOffset`, `_todayOffset` in host
- `aria-disabled` on out-of-range buttons; `event.stopPropagation()` so buttons don't trigger card-level tap_action
- `time_grid_navigation_days` plumbed through `fetchEventData` via new optional `effectiveDaysToShow?: number` arg (3 callsites in `events.ts`: cache key, `getTimeWindow`, post-fetch filter)
- Host's `updateEvents` updated to pass `effectiveDaysToShow` when `view === 'time-grid'`
- `hasConfigChanged` made view-aware:
  - `viewChanged` triggers refetch (toggling list↔grid changes effective fetch range)
  - When `view: 'time-grid'`, `days_to_show` mutations are ignored
  - When `view: 'list'`, `time_grid_navigation_days` mutations are ignored

## Out of scope (deferred)

- All-day banner rendering → epic02
- Now-line + midnight refresh → epic02
- Editor UI for new fields → epic03
- Auto-scroll-to-now-line on initial render when `max_height` clips the grid → follow-up
- 100-overlap-events cap → follow-up
- Hiding `days_to_show` in editor when `view: 'time-grid'` → epic03

## User-facing outcome

After this epic:

```yaml
type: custom:calendar-card-pro
entities: [calendar.work]
view: time-grid
time_grid_navigation_days: 28
time_grid_max_days: 7
time_grid_breakpoint_three_day_px: 500
time_grid_breakpoint_seven_day_px: 900
```

…on a 1200px-wide dashboard column shows 7 days; on a 700px dashboard column shows 3 days; on a 320px mobile column shows 1 day. `<<` `<` Today `>` `>>` (or compact subset on N=1 / N=7) lets the user navigate up to 4 weeks ahead without a network refetch.

## Stories

| #                       | Title                                                   | Status      |
| ----------------------- | ------------------------------------------------------- | ----------- |
| [story1-1](story1-1.md) | Responsive `ResizeObserver` + width-based column count  | Not started |
| [story1-2](story1-2.md) | Navigation handlers `<` `>` `<<` `>>` `Today`           | Not started |
| [story1-3](story1-3.md) | Window alignment (week-aligned 7-day, rolling 1/3-day)  | Not started |
| [story1-4](story1-4.md) | Fetch-window decoupling via `time_grid_navigation_days` | Not started |

## Acceptance for the epic as a whole

- All stories complete with their acceptance criteria met
- `npm run lint` clean
- `npm run build` succeeds; cumulative bundle delta (epic00 + epic01) ≤ +25 KB (cap raised in worklog 0020)
- `npm test` passes (new tests for `_todayOffset`, `hasConfigChanged` view-aware logic)
- Manual smoke test 1: resize browser narrow→wide, column count changes 1→3→7
- Manual smoke test 2: nav buttons work; `<<` shifts by N; `<` `>` hidden in 7-day mode
- Manual smoke test 3: `start_date: '-7'` + Today button correctly snaps to today's offset within fetch window
- Manual smoke test 4: toggle `view: list` ↔ `view: time-grid` triggers refetch (different cache slot)

## Dependencies

- epic00 (time-grid base view) — needs the rendering module to exist and the `view` config field

## Blocks

- epic02 (all-day + now-line) — uses the navigation context for "is today in window" detection
- epic03 (editor) — exposes the new fields in the visual editor

## Mapping to design doc FRs

| FR                     | Story    | Notes                                                                                      |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------ |
| FR-3.1, FR-3.2, FR-3.3 | story1-1 | Responsive selection + breakpoints + cap                                                   |
| FR-3.4                 | story1-1 | Initial measurement in connectedCallback; width=0 fallback                                 |
| FR-3.5                 | story1-1 | N change re-renders only (no refetch)                                                      |
| FR-4.1 through FR-4.6  | story1-2 | Navigation buttons + handlers + a11y                                                       |
| FR-5.1, FR-5.2, FR-5.3 | story1-3 | Week-aligned vs rolling; Today button uses `_todayOffset()`                                |
| FR-5.4, FR-5.5         | story1-4 | Fetch-window decoupling; view-aware `hasConfigChanged`                                     |
| FR-5.6                 | story1-4 | Helper-text hint when `nav_days < max_days` (rendered, but the editor surfacing is epic03) |
