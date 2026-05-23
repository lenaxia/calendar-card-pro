# Epic 00 — Time-Grid Base View

**Status**: Not started
**Source issue**: [alexpfau/calendar-card-pro#300](https://github.com/alexpfau/calendar-card-pro/issues/300)
**Related issues**: [#14](https://github.com/alexpfau/calendar-card-pro/issues/14) (Column View)
**Design doc**: [`docs/design/time-grid-view.md`](../../design/time-grid-view.md)
**Feature branch**: `feature/time-grid-week-view`

---

## Why this epic exists

Today, calendar-card-pro renders events as a **vertical list grouped by day**. Users want a Google-Calendar–like **time-grid view** where events are positioned at their actual start time on a 2-D plane — vertical axis = time of day, horizontal axis = days. This is the foundational rendering mode; subsequent epics add responsiveness (epic01), all-day banners + now-line (epic02), and editor/localization polish (epic03).

This epic delivers the **minimum viable grid**: a `view: 'time-grid'` config option that renders timed events at the right `top`/`height` in a single fixed-width column layout (defaults to 7-day, no responsive switching yet — that's epic01). All-day events are not yet rendered (epic02). Navigation buttons are not yet present (epic01). Default theming integrates with the existing card chrome.

## In scope

- New `view: 'list' | 'time-grid'` config field (default `'list'`)
- New `time_grid_*` config fields for layout (start hour, end hour, interval, slot height, min event height)
- Pure helpers in `src/utils/grid.ts`: `minutesFromMidnight`, `startOfDay`, `daysBetween`, `computeEventPlacement`, `layoutOverlaps` (cluster-based), `splitTimedEventByDay`, `getReferenceDate`, `isPastEvent`, `formatHourLabel`, plus `SLOT_HEIGHT_PX` constant
- New `src/rendering/render-grid.ts` rendering module
- Render dispatch in host: `view === 'time-grid'` branch
- CSS additions in `src/rendering/styles.ts` (scoped to `.ccp-grid*`)
- `getCardSize()` implementation for masonry-view sizing
- Vitest scaffolding (project's first test framework)
- Tests for all pure helpers (TDD)
- Past-event dimming via `past-event` class (timed only, mirroring list view)
- `show_past_events: false` filtering for timed past events

## Out of scope (deferred to later epics)

- **Responsive 1/3/7 column switching** → epic01
- **`<` `>` `<<` `>>` `Today` navigation buttons** → epic01
- **Week-aligned vs rolling window logic** → epic01
- **`time_grid_navigation_days` fetch-window decoupling** → epic01
- **All-day event banners** → epic02
- **Now-line** (the live "current time" indicator) → epic02
- **Midnight refresh** → epic02
- **Editor UI for grid options** → epic03
- **Localized labels and translations** → epic03
- **README + architecture.md updates** → epic03

## User-facing outcome

After this epic, a YAML user can do:

```yaml
type: custom:calendar-card-pro
entities: [calendar.work]
view: time-grid
time_grid_start_hour: 6
time_grid_end_hour: 22
time_grid_interval_minutes: 30
```

…and see a 7-day fixed-width grid with timed events placed at their start times. Switching back to `view: list` (or omitting `view`) leaves the existing list view byte-identical.

## Stories

| #                       | Title                                 | Status      |
| ----------------------- | ------------------------------------- | ----------- |
| [story0-1](story0-1.md) | Vitest test scaffolding               | Not started |
| [story0-2](story0-2.md) | Pure helpers in `utils/grid.ts` (TDD) | Not started |
| [story0-3](story0-3.md) | Config schema additions               | Not started |
| [story0-4](story0-4.md) | `render-grid.ts` rendering module     | Not started |
| [story0-5](story0-5.md) | Render dispatch + minimal host wiring | Not started |
| [story0-6](story0-6.md) | Grid CSS in `styles.ts`               | Not started |
| [story0-7](story0-7.md) | `getCardSize()` for masonry view      | Not started |

## Acceptance for the epic as a whole

- All stories complete with their acceptance criteria met
- `npm run lint` clean
- `npm run build` succeeds; bundle delta within design budget (≤ +25 KB minified — cap raised in worklog 0020)
- `npm test` passes (Vitest, ~30 cases for pure helpers)
- Manual smoke test: list view (no `view` set) is visually unchanged from `upstream/dev` HEAD
- Manual smoke test: `view: time-grid` renders a 7-day grid with correctly positioned timed events at default settings

## Dependencies

- None (this is the foundation)

## Blocks

- epic01 (responsive + navigation) — needs the rendering module to exist
- epic02 (all-day + now-line) — needs the rendering module + render-grid layout
- epic03 (editor + i18n) — needs the config fields

## Mapping to design doc FRs

| FR                     | Story              | Notes                                               |
| ---------------------- | ------------------ | --------------------------------------------------- |
| FR-1.1, FR-1.3, FR-1.4 | story0-3, story0-5 | View selector, dispatch                             |
| FR-1.2                 | story0-5           | List view byte-identical (enforced by code review)  |
| FR-2.1                 | story0-4, story0-6 | N day columns (N=7 fixed for this epic)             |
| FR-2.2                 | story0-4           | Day-column headers                                  |
| FR-2.3, FR-2.4         | story0-2, story0-3 | Hour range + slot interval                          |
| FR-2.5, FR-2.6         | story0-2, story0-4 | Event placement + clipping                          |
| FR-2.8                 | story0-2           | `splitTimedEventByDay`                              |
| FR-2.9                 | story0-2           | Cluster-based overlap layout                        |
| FR-2.11                | story0-2, story0-4 | `isPastEvent` + dimming + `show_past_events` filter |
| FR-2.12                | story0-4           | Empty events render structure                       |
| FR-9                   | story0-6           | Theming + CSS variables                             |
| FR-10                  | story0-7           | `getCardSize`                                       |
| FR-11.1, FR-11.2       | (entire epic)      | List view unchanged + bundle budget                 |
