# Design: Time-Grid View with Responsive 1/3/7-Day Columns

**Status:** Draft v13 — design only, no code yet (revised after twelfth self-review)
**Issue:** [#300](https://github.com/alexpfau/calendar-card-pro/issues/300)
**Related issues:** [#14](https://github.com/alexpfau/calendar-card-pro/issues/14) (Column View), [#239](https://github.com/alexpfau/calendar-card-pro/issues/239) (Monthly view — out of scope), [#282](https://github.com/alexpfau/calendar-card-pro/issues/282) (All-day banners), [#296](https://github.com/alexpfau/calendar-card-pro/issues/296) (start-of-week alignment), [#325](https://github.com/alexpfau/calendar-card-pro/issues/325) (live "now" line)

This is a spec-driven, test-driven design document. Every assumption is explicit, every claim is cited to source. Acceptance criteria are written as executable specs **before** any production code is written.

> **Revision history**
> - **v1** — initial draft.
> - **v2** — corrections after first self-review (DST handling, fetch-window decoupling, etc.).
> - **v3** — corrections after second self-review (validated by line-by-line code re-read; only confirmed bugs fixed):
>   - **C-1**: `time_grid_breakpoints` flattened to two top-level scalars to avoid the shallow-merge data-loss bug (`setConfig` does `{ ...DEFAULT_CONFIG, ...config }` which destroys partial nested objects).
>   - **C-4**: Now-line moved inside the today day-column (was rendered at body level with `left: 0; right: 0`, spanning all columns).
>   - **C-5**: Initial width measurement moved from `firstUpdated()` (which runs *after* first render) to `connectedCallback()` (before Lit schedules the first render). Reading `offsetWidth` synchronously forces a layout pass.
>   - **C-6**: `getCardSize` formula corrected to account for actual rendered grid height (was off by ~6 rows in masonry view).
>   - **C-7**: Risk description corrected — without `getGridOptions`, section-view cards are full-width natural-height (fine). `getCardSize` is for masonry view only.
>   - **C-2 (clarification)**: Fetch-window override touches 3 callsites in `events.ts`, not 1. Documented.
>   - **H-2**: `splitTimedEventByDay` must drop zero-duration segments produced by events ending exactly at midnight.
>   - **H-5**: Now-line element is rendered ONLY when today is in the visible window, INSIDE today's day-column (combines with C-4 fix).
>   - **H-6**: Per-column count uses inline `styleMap` `grid-template-columns`, not `repeat(var(--n))`.
>   - Smaller fixes: H-1 (visibility-pause wording), H-3 (editor hint not silent override), H-4 (spec explanation rewritten), M-1 (sort precondition), M-2 (`time_grid_event_min_height_px: number`), M-4 (drop unused CSS var), M-6 (add empty-events spec), L-2 (card-mod note), L-3 (terminology cleanup).
>   - **Adjudicated as non-issues:** v2-C3 (cache collision — false alarm; `daysToShow` is already in the cache key), v2-M3 (wording was accurate), v2-L4 (acknowledgment, not bug).
> - **v13** — corrections after twelfth self-review (1 real bug fixed, 1 metric adjusted, 5 confirmed non-issues):
>   - **v12-F6**: FR-2.7 now shows the explicit `eventEndDay` computation (`parseAllDayDate(event.end.date)` then `setDate(getDate() - 1)` to convert iCal exclusive end to inclusive last visible day).
>   - **v12-F7**: Bundle size target relaxed from +15 KB to +20 KB (more realistic per estimate of grid + render-grid + helpers + CSS).
>   - **NON-ISSUES** (5): v12-F1 (`processEvents` runs in `fetchEventData`, grid view inherits), v12-F2 (post-fetch filter is upper-bound only), v12-F3 (cross-midnight events handled correctly by HA + splitter), v12-F4 (cross-integration HA quirks not our concern), v12-F5 (new CSS vars are theme-only, not user-configurable).
>   - **Convergence**: 23 → 18 → 13 → 8 → 5 → 11 → 8 → 10 → 8 → 7 → 7. **Strong diminishing returns**: 5/7 findings this pass were non-issues. Substantive bug rate has dropped from "would-have-shipped-broken" to "implementation-will-figure-it-out".
> - **v12** — corrections after eleventh self-review (3 real bugs fixed; 3 partial items addressed):
>   - **v11-F5**: **Host-side `updateEvents` change shown explicitly.** v11 specified the receiver (`fetchEventData` accepting `effectiveDaysToShow?`) but the caller (`calendar-card-pro.ts:538`) was not updated in the design. Without this change, the entire fetch-window decoupling is **dormant** — grid view would silently fetch `days_to_show: 3` (default), breaking navigation. Substantive bug; would have shipped broken.
>   - **v11-F1**: `daysBetween` now normalizes inputs internally with `startOfDay` to be safe even if non-midnight Dates leak in. Cheap defense.
>   - **v11-F2**: `startOfWeek` and `snapToWindow` JSDocs explicitly state "returns local-midnight Date(s)". Specs G-5.1/5.1b/5.2 add `at 00:00 local` assertions.
>   - **PARTIAL**: v11-F4 (phasing notes), v11-F6 (`getReferenceDate` JSDoc), v11-F7 (`tap_action: expand` no-op in grid) — addressed via clarifying notes.
>   - **NON-ISSUE**: v11-F3 (§6 size) — proportional to scope.
>   - **Convergence**: 23 → 18 → 13 → 8 → 5 → 11 → 8 → 10 → 8 → 7. Slow decline. v11-F5 found a substantive **shipped-broken-without-this-fix** issue.
> - **v11** — corrections after tenth self-review (3 real bugs fixed; 5 partial items addressed):
>   - **v10-F2**: `daysBetween` uses `Math.round` not `Math.floor`. Floor was wrong across DST transitions: a 23-hour day (spring-forward) gave `floor(23h/24h) = 0` instead of 1, breaking banner placement. Round handles ±1h DST and ±30-min DST (Lord Howe) correctly. Test spec corrected.
>   - **v10-F3**: FR-2.5 progressive disclosure now honors per-entity `show_location`/`show_description` settings via `EventUtils.getEntitySetting` (matches list-view behavior at `events.ts:241,246`).
>   - **v10-F6**: New Spec G-hasConfigChanged covers view-toggle, gated `days_to_show`, gated `time_grid_navigation_days`.
>   - **PARTIAL**: v10-F1 (`_lastRenderDay` initial value), v10-F4 (banner weather wording), v10-F5 (FR-2.11 'now' source clarified), v10-F7 (DEFAULT_CONFIG additions), v10-F8 (extreme overlap cap deferred) — all addressed via clarifying notes.
>   - **Convergence**: 23 → 18 → 13 → 8 → 5 → 11 → 8 → 10 → 8. Pattern is clear: ~8-10 findings per pass with 2-3 real substantive bugs each time.
> - **v10** — corrections after ninth self-review (5 real bugs fixed; 4 partial/cosmetic items addressed):
>   - **v9-F1**: `_updateNowLinePosition` in §6.5 now does the midnight check **before** the `lineEl` null-guard. Otherwise stale state persists when today is out of the visible window.
>   - **v9-F2**: Spec G-pastEventsFilter setup explicitly states "visible window includes May 12" so the test isolates filter behavior from windowing.
>   - **v9-F3**: `hasConfigChanged` now also detects `view` field changes — toggling list↔grid triggers refetch (cache key changes anyway, but `updateEvents` must be called).
>   - **v9-F4**: FR-2.7 banner placement now uses an explicit `daysBetween(a, b)` helper (define in `utils/grid.ts`) rather than implicit Date arithmetic.
>   - **v9-F6**: FR-7.7 added — explicit pattern for hiding `days_to_show` in editor when `view: time-grid`.
>   - **v9-F10**: Spec G-getCardSize arithmetic corrected (13 → 14 for 24h/60min config).
>   - **PARTIAL**: v9-F5 (banner stacking order), v9-F7 (24h+15min = 2304px tall warning), v9-F8 (phasing notes), v9-F9 (slot-based thresholds vs hardcoded) — all addressed via clarifying notes, not behavior changes.
>   - **Convergence**: 23 → 18 → 13 → 8 → 5 → 11 → 8 → 10. Settled around 8-10 per pass; substantive bugs surface based on focus area each pass.
> - **v9** — corrections after eighth self-review (4 real bugs fixed; 3 partial issues acknowledged):
>   - **v8-F1**: FR-2.11 over-promised filtering. Corrected to match existing `events.ts:168-172` semantics: `show_past_events: false` filters only **timed** past events; all-day past events still render (dimmed via `past-event` class).
>   - **v8-F2**: `hasConfigChanged` view-aware behavior now spelled out explicitly in §6.2 — `current.view !== 'time-grid'` gating on `days_to_show` comparison.
>   - **v8-F3**: Spec G-pastEventsFilter expanded to test both cases (timed past hidden, all-day past visible).
>   - **v8-F5**: New FR-11.5 added — a midnight timer triggers `requestUpdate()` to refresh "today" highlighting and now-line position. Piggybacks on the existing now-line interval (each tick checks if local-day has changed since last render and forces re-render if so). Avoids stale "today" column after midnight.
>   - **PARTIAL**: v8-F6 (`today_indicator` reuse wording in §7) — replaced with "Not currently applied in grid view; today is highlighted via the now-line and a 'today' class on the day-column header".
>   - **PARTIAL**: v8-F7 (event-block content) — FR-2.5 now specifies title (always), time-range (when height ≥ 32px), location (when height ≥ 56px). Mirrors Google Calendar's progressive disclosure.
>   - **PARTIAL**: v8-F8 (`getCardSize` not in test plan) — added 4 cases.
>   - **NON-ISSUE**: v8-F4 (`.ccp-grid-axis-spacer` no CSS) — empty div sized by parent grid; intentionally minimal.
>   - **Convergence**: 23 → 18 → 13 → 8 → 5 → 11 → 8. The trajectory is settling around 8 (mostly cosmetic + occasional substantive bugs found in newly-examined areas).
> - **v8** — corrections after seventh self-review (8 real bugs fixed; convergence broke from 5→11, exposing missed issues from earlier passes):
>   - **v7-F1/F2**: Wrong citation `format.ts:33-36` corrected to actual line `format.ts:70-71`. Removed invented `Intl.DateTimeFormat`-based resolution; existing code is simply `config.time_24h === true` (boolean coerce, `'system'` resolves to `false`). Hour-axis labels now use this simple resolution.
>   - **v7-F3**: `formatHourLabel` moved from `render-grid.ts` to `utils/grid.ts` to match the test plan §10.1 location and enable unit testing.
>   - **v7-F4 + F-5**: Hour-label range tightened. Labels rendered at hours `[start_hour, start_hour+1, ..., end_hour-1]` only — never `end_hour`. Avoids the hour-24 edge case (which would produce "24" or duplicate "12 PM") and matches Google Calendar convention. Total labels = `end_hour - start_hour`.
>   - **v7-F7**: `show_past_events: false` is now honored in grid view. The renderer filters past events out (using `isPastEvent`), not just dims them. Matches list view's behavior.
>   - **v7-F8**: §7 table now states that `days_to_show` is hidden in the editor when `view: time-grid`. `hasConfigChanged` ignores `days_to_show` changes when `view: time-grid` (avoids wasted refetches).
>   - **v7-F10/F11**: Leftover `formatTime` references replaced with `formatHourLabel` in FR-8.1 and renderer markup.
>   - **PARTIAL**: v7-F6 (`if positive` ambiguity) — wording cleaned up to "if heightPx > 0 and < minHeightPx".
>   - **NON-ISSUE**: v7-F9 (`getReferenceDate` unused Pick field) — keep as-is.
>   - **Convergence note**: 23 → 18 → 13 → 8 → 5 → **11** (regression). v7 introduced new errors (wrong citations, leftover wording) and previously-missed issues surfaced. v8 should drop back to ≤4.
> - **v7** — corrections after sixth self-review (3 trivial wording fixes + 1 partial defensive guard):
>   - **v6-F1**: FR-2.4 now specifies how `time_24h: 'system'` is resolved before passing to `formatHourLabel` — reuses existing logic from `format.ts:33-36`.
>   - **v6-F2**: Test plan (§10.1) now includes `formatHourLabel` test cases.
>   - **v6-F4**: FR-11.4 rephrased to accurately describe the implementation: interval runs continuously while view is time-grid (and not document-hidden); position update is a no-op when today is not in the visible window.
>   - **v6-F5**: FR-2.7 now includes a defensive guard: skip banners with `numDays ≤ 0`.
>   - **NON-ISSUE** confirmed: v6-F3 (FR-1.4 silent-coerce — consistent with existing tolerant style).
>   - Convergence: 23 → 18 → 13 → 8 → 5 findings per pass. v7 should be approaching steady state.
> - **v6** — corrections after fifth self-review (4 trivial fixes + 2 acknowledged partials):
>   - **v5-F2**: Spec G-2.7a typo "3-day span" → "4-day span" (May 13, 14, 15, 16 = 4 days).
>   - **v5-F5**: FR-2.4 hour-axis labels now specify a dedicated hour-only format (e.g. `6` / `6 AM`), not `formatTime(date, ...)` which always includes `:00`. Saves axis width.
>   - **v5-F7**: Outdated comment in §6.4 renderer markup (banner background) updated.
>   - **v5-F1**: Spec G-4.4 clarified — tests the underlying `_shiftDays` method; the button is only visible in N=3 mode (per FR-4.1).
>   - **v5-F4**: FR-4.1 N=7 reference now points to FR-5.1 for "week-aligned" definition.
>   - **PARTIAL** items acknowledged: v5-F6 (loading-state grid skeleton — deferred).
>   - **NON-ISSUES** confirmed: v5-F3 (`slotHeightPx` parameter), v5-F8 (`_fireConfigChanged` triggers re-render via reactive `_config`).
>   - Convergence note: 23 → 18 → 13 → 8 findings per pass; v6 is approaching stability.
> - **v5** — corrections after fourth self-review (7 real bugs fixed; 4 partial issues acknowledged):
>   - **v4-F1**: `chooseVisibleDays` "no measurement" fallback now triggers only when `width === 0` (not `< 50`). A genuinely tiny card (e.g. 49px) returns N=1 (correct for the size) instead of cap.
>   - **v4-F3**: Banner background was nearly invisible by default in v4 (`event_background_opacity: 0`). Introduced dedicated `time_grid_allday_bg_opacity` (default `0.2`) for banners specifically. Solves both contrast (decoupled from list-view's `event_background_opacity`) and visual-identity (default makes banners visible).
>   - **v4-F5**: Removed `overflow-y: auto` from `.ccp-grid`. The existing `.content-container` already provides scroll, so v4's addition would create nested scroll containers (touch-scroll fights). Original concern (silent clipping) doesn't apply because parent always scrolls.
>   - **v4-F6**: All-day banner placement now clamps `dayIdx = max(0, eventStart - windowStart)` and `numDays = min(originalSpan - clampOffset, visibleDays - dayIdx)` so banners that start before / end after the visible window render correctly (and get `◂` / `▸` overflow indicators).
>   - **v4-F9**: Dropped `--calendar-card-grid-slot-height` CSS variable. Slot height is now a code constant (`SLOT_HEIGHT_PX = 24`) used consistently across renderer, `_updateNowLinePosition`, and `getCardSize`. Eliminates the card-mod inconsistency risk.
>   - **v4-F10**: In 7-day week-aligned mode, single-step `<` `>` buttons are hidden (would mostly be no-ops because the window snaps to week boundaries). Only `<<` `>>` and `Today` are shown.
>   - **v4-F12**: FR-8.1 typo fixed ("four" → "five" navigation strings).
>   - **PARTIAL** items acknowledged: v4-F2 (`Today` is a no-op when `start_date` is in future — user explicit configuration; documented), v4-F7 (FR-7.6 comparison clarified), v4-F8 (auto-scroll-to-now is a follow-up), v4-F13 (`getCardSize` only handles px `max_height` — best-effort, documented).
>   - **NON-ISSUES** confirmed: v4-F4 (dispatch order), v4-F11 (corner-loader inheritance).
> - **v4** — corrections after third self-review (10 real bugs fixed; 4 confirmed non-issues; 3 partial issues acknowledged):
>   - **F-1**: `.ccp-grid-body` was missing layout — time-axis wouldn't align with columns/headers. Fixed by making `.ccp-grid-body` a 2-column grid (`time-axis-width 1fr`).
>   - **F-2**: Width=0 fallback (parent not yet laid out) → fall back to **cap** (default 7), not minimum (1), to avoid a flash of N=1 then N=7.
>   - **F-5**: Grid scroll behavior — added `overflow-y: auto` on `.ccp-grid` so `max_height` clipping shows a scrollbar instead of silent clipping.
>   - **F-6**: Hour-range constraints tightened: `0 ≤ start_hour ≤ 23, 1 ≤ end_hour ≤ 24, start < end`. Invalid → reset both to defaults.
>   - **F-8**: `Today` button now computes today's offset within the fetch window (was hardcoded to 0, which only worked when `start_date` was today).
>   - **F-9**: All-day banners default to `event_background_opacity` (existing config, default 0 = transparent) for the accent background, fixing potential contrast issues. Inheriting existing user theming intent.
>   - **F-11**: Render dispatch order made explicit (loading → error → time-grid view → list-empty → list-normal).
>   - **F-12**: All-day banner column-placement spelled out: `grid-column-start: <dayIdx + 2>; grid-column-end: span <numDays>` (axis is column 1).
>   - **F-14**: Replaced `border-left` with `border-inline-start` in `.ccp-grid-event` for RTL correctness.
>   - **F-16**: Added defensive check `if (endMin ≤ startMin) outsideRange=true` to `computeEventPlacement` contract.
>   - **F-18**: Hour-axis labels: one label per hour, top-aligned with the H:00 slot. Documented in FR-2.4.
>   - **PARTIAL** items acknowledged: F-4 (`getCardSize` ignores `max_height` — same as list view's behavior; clamp added as a one-liner), F-13 (event 22:00–24:00 with `end_hour=22` is correctly hidden — documented), F-15 (now-line interval still ticks when today out of window — wasteful but harmless; optimization deferred).
>   - **NON-ISSUE** items confirmed: F-3 (FR-1.4 wording fine), F-7 (cross-tz consistent with list view), F-10 (tap_action passthrough consistent), F-17 (variable name cosmetic).

---

## 1. Goals

1. Add a **time-grid view** that lays out timed events on a 2-D plane: vertical = time of day, horizontal = day columns.
2. Auto-adjust the number of visible day columns based on **rendered card width** (1 / 3 / 7), with configurable breakpoints.
3. Provide **navigation controls**: shift the visible window by 1 day (`<`/`>`) or by the full visible window (`<<`/`>>`); a `Today` button to reset.
4. Render **all-day events** in a banner strip above the grid (Google-Calendar-like).
5. Optionally show a **"now" indicator line** on today's column.
6. Ship the change **without regressions** to the existing list view, which remains the default.

## 2. Non-goals (this PR)

- Monthly grid view (#239).
- Drag-to-create / drag-to-move events.
- Calendar-app-grade overlap packing (we use a simple cluster-based algorithm — see FR-2.9).
- Persisting navigation offset across page reloads.
- WebSocket subscription to `calendar/event/subscribe` — keep current REST polling.
- A full unit-testing CI job (we add a `test` script; CI integration is a follow-up).
- All-day banner overflow ("+N more" chip) — defer; v1 uses CSS `max-height` clipping.
- Sub-15-minute slot intervals (would produce 2000+ px-tall grids).
- `getGridOptions()` for HA section-view — not needed (default behavior is full-width natural-height); follow-up if requested.

## 3. Assumptions and validation status

Every assumption is listed with how it was verified, with file:line citations against `feature/time-grid-week-view` HEAD.

| # | Assumption | How verified | Status |
|---|---|---|---|
| A1 | Repo has a `dev` branch that PRs target | `CONTRIBUTING.md`, `git branch -r` | ✅ Verified |
| A2 | Project builds with `npm run build` (rollup + esbuild) and lints with `npm run lint` (ESLint + Prettier) | Ran both on the feature branch (clean baseline) | ✅ Verified |
| A3 | No test infrastructure; CI runs `lint` + `build` on PRs | `package.json` has no `test`; `.github/workflows/ci.yml` runs `lint` and `build` | ✅ Verified |
| A4 | Card uses Lit 3 (`lit: ^3.3.2`) with `@customElement` and `@property({ attribute: false })` decorators | `package.json`; `src/calendar-card-pro.ts:73-88` | ✅ Verified |
| A5 | Custom element registers as `calendar-card-pro-dev` in dev builds; rollup rewrites to `calendar-card-pro` for prod | `rollup.config.mjs:39`; `src/calendar-card-pro.ts:73` | ✅ Verified |
| A6 | `Config` interface contains no `view`, `view_mode`, `layout_mode`, `time_grid_*` fields today | grep in `src/`: zero functional matches | ✅ Verified |
| A7 | `DEFAULT_CONFIG.days_to_show = 3` | `src/config/config.ts:20` | ✅ Verified |
| A8 | `setConfig` merges via `{ ...DEFAULT_CONFIG, ...config }` (shallow). **Nested object defaults are lost when the user provides a partial nested object.** Existing `weather` config dodges this via a special-case deep-clone in `helpers.ts:346`. | `src/calendar-card-pro.ts:482`; `src/utils/helpers.ts:346` | ✅ Verified — informs C-1 fix |
| A9 | `Config.hasConfigChanged` triggers data refetch when `entities`, `days_to_show`, `start_date`, `show_past_events`, `filter_duplicates`, or `refresh_interval` change | `src/config/config.ts:209-246` | ✅ Verified — must add `time_grid_navigation_days` |
| A10 | Events are fetched once for `days_to_show` from `start_date` reference, cached in `localStorage`. **`fetchEventData` references `config.days_to_show` in 3 places** (cache key arg at line 39, `getTimeWindow` at 61, post-fetch filter at 70-88). The grid view must override at all three. | `src/utils/events.ts:29-95` | ✅ Verified |
| A11 | HA's `calendars/{entity}?start=…&end=…` REST endpoint returns events whose interval intersects the window | HA developer docs | ✅ Verified |
| A12 | All-day events have `start.date` (YYYY-MM-DD), no `dateTime`; their `end.date` is **exclusive** in iCal | `src/utils/events.ts:142-147`; HA docs | ✅ Verified |
| A13 | Timed events have `start.dateTime` as ISO 8601 with TZ offset; `new Date(...)` projects to local time correctly | `src/utils/events.ts:149-150` | ✅ Verified |
| A14 | `src/utils/format.ts` exports `parseAllDayDate`, `getLocalDateKey`, `formatTime`, `getFirstDayOfWeek` | grep `^export (function|const)` | ✅ Verified |
| A15 | `getStartDateReference` is **module-private** in `events.ts` (line 1486) — not exported | grep | ✅ Verified |
| A16 | `groupEventsByDay` injects synthetic `_isEmptyDay` events. Grid view bypasses this function entirely. | `src/utils/events.ts:540-555` | ✅ Verified |
| A17 | Editor is a hand-rolled LitElement (not `ha-form` schema). Editor stores config in `_config` and accesses via `getConfigValue(path)` (dot-notation supported, see line 116). The editor's `setConfigValue` deep-clones via `JSON.parse(JSON.stringify(...))` then sets nested paths (line 191). Conditional UI reveal pattern: `requestUpdate()` after a `getConfigValue` check (existing example: `editor.ts:660` for `start_date_mode`). | `src/rendering/editor.ts:59, 116, 191, 660, 1453-1675` | ✅ Verified |
| A18 | Translations: `getTranslations(lang)` (`localize.ts:164-167`) returns the entire bundle, falling back to `'en'` when `lang` is not loaded. `translate(lang, key, fallback)` returns the key string itself if not found. For *editor* translations specifically, `editor.ts:344-358` falls through to English when the language has no `editor` block. | Re-read `localize.ts:160-209`, `editor.ts:340-358` | ✅ Verified |
| A19 | dayjs is used only for relative-time formatting; the rest of the code uses native `Date` | grep `dayjs` in `src/` | ✅ Verified |
| A20 | The card has no `@media` queries and no `ResizeObserver` usage today | grep | ✅ Verified |
| A21 | The card does not implement HA Lovelace `getCardSize()` / `getGridOptions()`. **Without `getGridOptions`, section-view cards are full-width natural-height** (HA frontend default). `getCardSize` defaults to 1 (50 px) which is bad for masonry view. **This PR adds `getCardSize`; we do NOT add `getGridOptions`.** | grep returns no matches; HA developer docs | ✅ Verified |
| A22 | ESLint flat config enforces `@typescript-eslint/no-explicit-any: error`, `import/order`, `prettier/prettier`, `sort-imports` (member only). `noUnusedParameters: true` in `tsconfig.json`. | `eslint.config.mjs`, `tsconfig.json` | ✅ Verified |
| A23 | `tsconfig.json`: `target: ES2017`, `lib: [ES2017, DOM, DOM.Iterable]`, `noEmit: true` (esbuild compiles). `lib.dom.d.ts` includes `ResizeObserver`. | `tsconfig.json` | ✅ Verified |
| A24 | All browsers HA supports include `ResizeObserver` (Chromium, Firefox 69+, Safari 13.1+). | Spec | ✅ Verified |
| A25 | The card runs inside HA dashboards; width is dictated by parent container, not viewport. The implementation observes the **card's own width** via `ResizeObserver` on `this`. | HA documentation pattern | ✅ Verified |
| A26 | **Lit lifecycle:** `constructor → connectedCallback → first update/render → firstUpdated`. `connectedCallback` runs *before* the first render, and reading `this.offsetWidth` there forces a synchronous layout pass returning a valid width. `firstUpdated` runs *after* the first render — too late to seed initial state without a re-render. | Lit docs; spec semantics | ✅ Verified — informs C-5 fix |
| A27 | When `view: 'time-grid'`, fetch a wider window (`time_grid_navigation_days` days, default 28) so users can navigate ~4 weeks without re-fetching. | Stakeholder decision | ✅ |
| A28 | The HA frontend allows `customElements.define` to be called only once per name | Web Components spec | ✅ Verified |
| A29 | The visual editor (`calendar-card-pro-dev-editor`) is a separate web component | `src/calendar-card-pro.ts:651` | ✅ Verified |
| A30 | Most internal helpers (`splitMultiDayEvent`, `processMultiDayEvents`, `renderEventWeather`, `formatAllDayDate`, `isMultiDayEvent`, `renderTodayIndicator`) are not exported. The grid view replicates only the small bits it needs in `utils/grid.ts`. | grep | ✅ Verified |
| A31 | Existing `splitMultiDayEvent` (events.ts:737) converts middle days of a multi-day timed event to **all-day** segments. We must not reuse it for grid view; we use our own splitter `splitTimedEventByDay` that preserves timed semantics. | `src/utils/events.ts:737-828` | ✅ Verified |
| A32 | `instanceId` is generated from `(entities, days_to_show, show_past_events, start_date)` and is the prefix of cache keys. The full cache key also embeds `daysToShow` separately (`getBaseCacheKey` line 1409). So toggling between list view and grid view (with different effective `daysToShow`) produces **different cache keys** even though `instanceId` is shared — caches do NOT collide. | `src/utils/helpers.ts: generateDeterministicId`; `src/utils/events.ts:1409` | ✅ Verified — false alarm in v2 |
| A33 | The existing `_handleVisibilityChange` (line 264-273) only acts on `'visible'` (data refresh). It does NOT pause anything on `'hidden'`. The grid view ADDS a `'hidden'` branch to pause the now-line interval; we are not "mirroring" existing pause behavior. | `src/calendar-card-pro.ts:264-273` | ✅ Verified |

## 4. Functional requirements (numbered, testable)

### FR-1: View selector
- **FR-1.1** A new `Config.view` field is introduced with type `'list' | 'time-grid'`. Default: `'list'`.
- **FR-1.2** With `view: 'list'` (or unset), the card render path is **unchanged**: same `Render.renderGroupedEvents` callsite, same arguments. No-regression is guaranteed by code review and a manual visual smoke test.
- **FR-1.3** With `view: 'time-grid'`, the card renders the new grid layout (FR-2 onwards).
- **FR-1.4** `setConfig` validates `view`: any value other than `'list'` or `'time-grid'` is silently coerced to `'list'`, with a `Logger.warn`.

### FR-2: Time-grid layout
- **FR-2.1** The grid shows N day columns side-by-side, where N ∈ {1, 3, 7} is determined responsively (FR-3).
- **FR-2.2** Each column has a header showing weekday name and day-of-month (and month, when the column is the first of a new month). Reuses `Localize.getTranslations(lang).daysOfWeek` and `.months`.
- **FR-2.3** Hour range: `time_grid_start_hour` (default 6) and `time_grid_end_hour` (default 22). Constraints: `time_grid_start_hour ∈ [0, 23]` (integer), `time_grid_end_hour ∈ [1, 24]` (integer), and `time_grid_start_hour < time_grid_end_hour`. If either constraint fails, **both** are coerced to defaults (6, 22) and a `Logger.warn` is logged.
- **FR-2.4** Slot interval is `time_grid_interval_minutes ∈ {15, 30, 60}`, default `30`. **Slot height is a fixed code constant** `SLOT_HEIGHT_PX = 24` (defined in `utils/grid.ts` and re-exported as needed). It is **not** a CSS custom property — that approach was considered in v4 and rejected because it created an inconsistency risk: card-mod could override the CSS variable for the renderer but the host's now-line update would read it independently, leading to mismatched event/now-line positioning. Sub-15-minute intervals are **deliberately not supported** in v1 (would produce 2000+ px-tall grids).

  **Hour-axis labels:** one label per hour, rendered at hours `[start_hour, start_hour+1, ..., end_hour - 1]` (NOT at `end_hour` — avoids labeling the bottom edge twice and avoids the `hour=24` edge case). Total labels = `end_hour - start_hour`. Each label is top-aligned with the slot at `H:00`.

  **Format**: hour-only (no minutes), respecting the resolved 24h flag. Resolution mirrors the existing logic at `format.ts:70-71`:
  ```ts
  // Existing logic in format.ts:70-71:
  //   const useNativeFormatting = !!(config.time_24h === 'system' && hass?.locale);
  //   const use24h = config.time_24h === true;
  //
  // For hour-axis labels we use the same simple coerce. 'system' resolves to false
  // (12-hour AM/PM). Users wanting 24h must set time_24h: true explicitly.
  const use24h = config.time_24h === true;
  ```
  - `use24h: true` → `0`, `1`, …, `23`
  - `use24h: false` → `12 AM`, `1 AM`, …, `11 AM`, `12 PM`, `1 PM`, …, `11 PM`

  Implementation: a pure helper in `utils/grid.ts:formatHourLabel(hour: number, use24h: boolean): string` (NOT in `render-grid.ts` — keeping it in `utils/grid.ts` matches its pure-function nature and enables unit-testing per §10.1). We do NOT reuse `FormatUtils.formatTime` because it always emits minutes (`6:00`, `6:00 AM`), wasting axis width.

  Labels for half-hour or quarter-hour slots are NOT rendered (would crowd at 15-min). At `60`-min interval, every slot is a labeled hour.
- **FR-2.5** Timed events are positioned absolutely within their day column. The pure helper `computeEventPlacement` (§6.3) returns:
  - **Defensive guard**: if `endMin ≤ startMin` (malformed input), returns `outsideRange: true`.
  - If `endMin ≤ gridStartMin` or `startMin ≥ gridEndMin` (event entirely outside visible window): `outsideRange: true`.
  - Otherwise: `topPx = (max(startMin, gridStartMin) - gridStartMin) / intervalMin * slotHeightPx`; raw `heightPx = (min(endMin, gridEndMin) - max(startMin, gridStartMin)) / intervalMin * slotHeightPx`. If `heightPx > 0 && heightPx < minHeightPx`, clamp to `minHeightPx`.
  - `clippedTop: true` iff `startMin < gridStartMin`; `clippedBottom: true` iff `endMin > gridEndMin`.

  **Event-block content** (progressive disclosure based on rendered height — mirrors Google Calendar):
  - Always: event title (one line, truncated with ellipsis).
  - When `heightPx ≥ 32px`: title + start-end time (HH:mm).
  - When `heightPx ≥ 56px`: title + time + location (if present).
  - **Per-entity overrides**: `show_location` and `show_description` are resolved via `EventUtils.getEntitySetting(event._entityId, 'show_location' | 'show_description', config, event)` — same pattern as list view at `events.ts:241,246`. The progressive-disclosure thresholds gate space; the per-entity (or global) flag gates intent.
  - Weather and description are NOT shown inline (deferred to a follow-up tooltip/expand interaction).
- **FR-2.6** Clipping indicators: events with `clippedTop` get a `↑` indicator; `clippedBottom` get `↓`. Events with `outsideRange: true` are aggregated into a small "+N hidden" pill at the top of the column.
- **FR-2.7** All-day events render in a banner strip above the time grid.
  - **Layout**: the strip is a CSS Grid with the same column template as the headers (`<axis-width> repeat(N, 1fr)`). For each banner, the renderer first computes `eventStartDay` and `eventEndDay` from the iCal event:
    ```ts
    const eventStartDay = FormatUtils.parseAllDayDate(event.start.date);  // local midnight
    const eventEndDay = FormatUtils.parseAllDayDate(event.end.date);      // iCal end (exclusive)
    eventEndDay.setDate(eventEndDay.getDate() - 1);                       // convert to inclusive last visible day
    ```
    Then (using `daysBetween` from `utils/grid.ts`):
    - `rawDayIdx = daysBetween(windowStart, eventStartDay)` — non-negative when event starts within or after window; negative when event started before window.
    - `dayIdx = max(0, rawDayIdx)` — clamped column offset within the visible window (0-based).
    - `clampOffset = max(0, -rawDayIdx)` — number of pre-window days lost.
    - `originalSpan = daysBetween(eventStartDay, eventEndDay) + 1` — inclusive day count (eventEndDay is iCal end minus 1 day, the last visible day of the event).
    - `numDays = min(originalSpan - clampOffset, visibleDays - dayIdx)` — span clamped to remaining window.
    - **Defensive guard**: if `numDays ≤ 0` (e.g., malformed iCal where `start === end`), the banner is **skipped** entirely. No invalid CSS `span 0` is emitted.
  - The banner is placed via inline `style="grid-column-start: <dayIdx + 2>; grid-column-end: span <numDays>"` (axis occupies grid column 1, so day columns start at column 2).
  - **Overflow indicators** (consistent with timed events' clip indicators FR-2.6):
    - If event started before window (`clampOffset > 0`): prepend `◂` to the banner content.
    - If event continues after window (`originalSpan - clampOffset > visibleDays - dayIdx`): append `▸`.
  - **Stacking order** (when multiple banners share a column): primary by ascending start date, secondary by descending span (longer banners first). CSS Grid auto-flow places non-overlapping banners in row 1; overlapping ones stack to additional rows.
  - **Background**: uses the entity accent color at `time_grid_allday_bg_opacity` (new config, default `0.2`). This is a banner-specific opacity, decoupled from the list-view's `event_background_opacity`. The accent line still appears as a solid `border-inline-start`.
  - **Strip bound**: CSS `max-height: var(--calendar-card-grid-allday-max-height, 6em)` with `overflow: hidden`.
- **FR-2.8** Multi-day timed events span only their per-day portion. The grid view splits via `splitTimedEventByDay` in `utils/grid.ts` (NOT `events.ts:splitMultiDayEvent`, which would convert middle days to all-day segments). **The splitter drops zero-duration segments** that arise when an event ends exactly at midnight (e.g., 22:00–00:00 produces one segment, not two).
- **FR-2.9** Overlap layout uses **cluster-based packing**:
  1. Events in the same column are **sorted by `startMin`** (helper sorts internally if not pre-sorted).
  2. Walk sorted events, building clusters of transitively-overlapping events: while `next.startMin < cluster_max_endMin`, extend cluster.
  3. For each cluster, `laneCount = max simultaneously-active events` at any instant.
  4. Greedy lane assignment within cluster: each event picks the lowest free lane at its `startMin`.
  5. All events in a cluster share `laneCount` (equal width).
  6. Half-open intervals: events touching at one instant (A ends at 10:00, B starts at 10:00) do **not** overlap (strict `<`).
- **FR-2.10** A "now" line is drawn on **today's** column when today is in the visible window. Implementation:
  - The renderer emits a `<div class="ccp-grid-now-line">` element ONLY when today is in `ctx.days`, **inside** the today day-column.
  - The host component updates the line's `style.top` imperatively (single DOM mutation, no Lit re-render) once per minute.
  - The line is also hidden (`style.display = 'none'`) when current time-of-day is outside `[time_grid_start_hour, time_grid_end_hour]`.
  - Controlled by `time_grid_show_now_line` (default `true`). The interval is paused when `document.visibilityState === 'hidden'`. (We add a `'hidden'` branch to the existing `_handleVisibilityChange`; the existing handler only handles `'visible'`.)
- **FR-2.11** Past events are handled the same as the existing list view: the `past-event` class (opacity reduction) is applied via `utils/grid.ts:isPastEvent(event, ctx.now)` (the `render.ts` version is module-private). The renderer uses `ctx.now` (the snapshot passed from the host at render time) for both dimming and filtering — ensures all events in a single render are evaluated against the same instant. **`config.show_past_events: false` filters out only TIMED past events** (events with `dateTime` whose `endDateTime < ctx.now`); all-day past events still render (dimmed). This matches the existing list-view filter at `events.ts:168-172` (`if (!isAllDayEvent && endDate < now) return false;`).
- **FR-2.12** Empty event list: when `events.length === 0`, the grid still renders column headers, time axis, and now-line (if today visible). No banner strip. No event blocks.

### FR-3: Responsive column count
- **FR-3.1** The card observes its own rendered width via `ResizeObserver` and selects N:
  - `width < bp_three` → N = 1
  - `bp_three ≤ width < bp_seven` → N = 3
  - `width ≥ bp_seven` → N = 7
- **FR-3.2** Defaults: `time_grid_breakpoint_three_day_px = 500`, `time_grid_breakpoint_seven_day_px = 900`. **These are two top-level scalar fields** (not a nested object) to avoid the shallow-merge data-loss bug in `setConfig` (see A8).
- **FR-3.3** A `time_grid_max_days: 1 | 3 | 7` cap (default `7`) clamps the maximum N. Wins over the breakpoints.
- **FR-3.4** **Initial width is measured in `connectedCallback()`** (after `super.connectedCallback()`), not `firstUpdated`. Reading `this.offsetWidth` synchronously forces a layout pass, returning a valid width before Lit's first render is scheduled.
  - **No-measurement fallback**: if the measured width is exactly `0` (parent not yet laid out, hidden tab, etc.), `chooseVisibleDays` treats it as "no measurement available" and returns the **cap** value (default 7) rather than 1. A genuinely tiny card (e.g. width=49) is treated as a real measurement and returns N=1 — so a sidebar widget doesn't try to cram 7 columns into 49px. `ResizeObserver` will correct on the first real measurement if the cap was wrong.
  - `ResizeObserver` handles all subsequent changes. Resize callback work is coalesced to one measurement per animation frame.
- **FR-3.5** When N changes, only the rendering re-runs — events are not re-fetched.

### FR-4: Navigation
- **FR-4.1** When `view: 'time-grid'`, the card displays a header bar above the grid:
  - **N = 7 (week-aligned per FR-5.1)**: `<<` `Today` `>>` plus the date-range label. Single-step `<` `>` buttons are **hidden** because the window snaps to week boundaries — a 1-day shift would mostly be a no-op (the same week is shown). Only week-step navigation makes sense.
  - **N = 3 (rolling per FR-5.2)**: `<<` `<` `Today` `>` `>>` plus the date-range label.
  - **N = 1 (compact)**: `<` `Today` `>` plus the date label only. (`<<`/`>>` would behave identically to `<`/`>` in 1-day view.)
- **FR-4.2** `<` / `>` shifts offset by 1 day (where applicable). `<<` / `>>` shifts by N days. `Today` resets offset to today's position within the fetch window (FR-5.3).
- **FR-4.3** Buttons are keyboard-accessible (Enter/Space), have ARIA labels, and call `event.stopPropagation()` so they do not trigger the card's tap/hold action.
- **FR-4.4** Navigation is constrained to the fetched window (`[reference, reference + time_grid_navigation_days)`). Buttons that would page outside are visually disabled with `aria-disabled="true"`. Past clamping, an attempted step is a no-op.
- **FR-4.5** Offset is **ephemeral** — does not persist across page reloads, not written to YAML.
- **FR-4.6** Date-range label clicks are inert.

### FR-5: Window alignment & navigation range
- **FR-5.1** When N = 7, the visible window is **week-aligned**: starts on `first_day_of_week` (Sunday or Monday).
- **FR-5.2** When N ∈ {1, 3}, the window is **rolling**: starts at `referenceDate + offsetDays`.
- **FR-5.3** `Today` returns the visible window to one containing today. Implementation:
  ```ts
  // Compute today's offset within the fetch window:
  // referenceDate is the start of the fetch window (today, or today-N if start_date is offset).
  // todayOffset = floor((today_local_midnight - referenceDate_local_midnight) / 1day)
  // Then clamp to [0, _maxOffset()].
  // For week-aligned (N=7), snapToWindow already snaps; we just need to land in the right week.
  ```
  This means `Today` works correctly even when `start_date` is set to a past date (e.g. `-7`, fixed historical date) — clicking `Today` snaps to today's position within the navigation window, not to offset 0.
- **FR-5.4** **Fetch window for time-grid view:** `time_grid_navigation_days` (default 28). Implementation: pass an optional `effectiveDaysToShow?: number` to `fetchEventData`. Inside `fetchEventData`, the override is used at **three callsites**:
  - line 39 (cache key argument)
  - line 61 (`getTimeWindow` call)
  - line 70 (post-fetch filter `limitDate`)

  `groupEventsByDay` (line 326) is unchanged — only used by list view.
- **FR-5.5** `hasConfigChanged()` is updated to be **view-aware** at `src/config/config.ts:234-239`:
  ```ts
  // BEFORE (existing):
  const dataChanged =
    previousEntityIds !== currentEntityIds ||
    previous.days_to_show !== current.days_to_show ||
    previous.start_date !== current.start_date ||
    previous.show_past_events !== current.show_past_events ||
    previous.filter_duplicates !== current.filter_duplicates;

  // AFTER (v10):
  const isGridView = current.view === 'time-grid';
  const viewChanged = previous.view !== current.view;
  const dataChanged =
    viewChanged ||                                                                    // toggling list↔grid changes effective fetch range
    previousEntityIds !== currentEntityIds ||
    (!isGridView && previous.days_to_show !== current.days_to_show) ||                 // list view: refetch on days_to_show
    (isGridView && previous.time_grid_navigation_days !== current.time_grid_navigation_days) ||  // grid view: refetch on nav days
    previous.start_date !== current.start_date ||
    previous.show_past_events !== current.show_past_events ||
    previous.filter_duplicates !== current.filter_duplicates;
  ```
  - When `view === 'time-grid'`, `days_to_show` mutations are ignored (grid view uses `time_grid_navigation_days` instead).
  - When `view === 'list'`, `time_grid_navigation_days` mutations are ignored (list view doesn't use it).
  - **`view` itself triggers refetch** so the cache and effective fetch range stay in sync (v10-F3 fix).
  - Other fields work as before.
- **FR-5.6** If a user sets `time_grid_navigation_days < time_grid_max_days`, the editor shows a hint in the field's helper-text recommending a higher value. **No silent override** — user can shoot themselves in the foot but is informed.

### FR-6: All-day banner strip
- **FR-6.1** Rendered when the visible window contains any all-day event.
- **FR-6.2** Strip height: `max-height: var(--calendar-card-grid-allday-max-height, 6em)`, `overflow: hidden`.
- **FR-6.3** Omitted (zero height) when no all-day events in window.

### FR-7: Editor support
- **FR-7.1** View selector (List / Time grid) inside Core Settings.
- **FR-7.2** When `view = time-grid`, the editor reveals a "Time grid" expansion panel: `time_grid_start_hour`, `time_grid_end_hour`, `time_grid_interval_minutes`, `time_grid_event_min_height_px`, `time_grid_max_days`, `time_grid_navigation_days`, `time_grid_breakpoint_three_day_px`, `time_grid_breakpoint_seven_day_px`, `time_grid_show_now_line`, `time_grid_allday_bg_opacity`.
- **FR-7.3** Conditional reveal uses `this.requestUpdate()` after the view selector changes (mirrors `editor.ts:660`).
- **FR-7.4** `Helpers.filterDefaultValues` keeps YAML minimal.
- **FR-7.5** Editor labels come from `editor.*` translation keys; English fallback applies (per A18).
- **FR-7.6** When `time_grid_navigation_days < time_grid_max_days`, the field's helper-text shows a warning hint.
- **FR-7.7** When `view === 'time-grid'`, the editor **hides** `days_to_show` and `compact_*` fields. Pattern (mirrors existing conditional rendering at `editor.ts:660`):
  ```ts
  // In the Core Settings expansion panel, around editor.ts:648:
  ${this.getConfigValue('view') !== 'time-grid'
    ? html`
        ${this.addTextField('days_to_show', this._getTranslation('days_to_show'), 'number')}
        <div class="helper-text">${this._getTranslation('days_to_show_note')}</div>
      `
    : nothing}
  ```
  When the user toggles the view selector, `_valueChanged` fires `_fireConfigChanged` which updates `_config` (reactive prop), Lit auto re-renders, the conditional re-evaluates, fields appear/disappear.

### FR-8: Localization
- **FR-8.1** No new user-facing strings outside the editor labels and five navigation strings (`time_grid_today`, `time_grid_prev_day_aria`, `time_grid_next_day_aria`, `time_grid_prev_window_aria`, `time_grid_next_window_aria`). Column headers reuse `daysOfWeek`/`months`. Hour labels use `formatHourLabel` (utils/grid.ts).
- **FR-8.2** New strings added to `en.json`. Other 32 languages can be updated in follow-ups.

### FR-9: Theming and styling
- **FR-9.1** Grid-view colors derive from existing config fields where reasonable (`accent_color`, `event_color`, `time_color`, `weekday_color`, `today_*_color`).
- **FR-9.2** New CSS custom properties (all under `--calendar-card-grid-*`):
  - `--calendar-card-grid-time-axis-width` (default `48px`)
  - `--calendar-card-grid-now-line-color` (default `var(--calendar-card-line-color-vertical)`)
  - `--calendar-card-grid-event-radius` (default `4px`)
  - `--calendar-card-grid-allday-max-height` (default `6em`)

  Note: slot height is **not** a CSS variable (v4-F9 fix); see FR-2.4.
- **FR-9.3** Per-event positioning (`top`, `height`, `left`, `width`) is applied **inline via Lit `styleMap`**, not via CSS custom properties. The grid container's `grid-template-columns` is also set inline via `styleMap` (avoids `repeat(var(--n))` fragility).

### FR-10: Lovelace card sizing
- **FR-10.1** The card implements `getCardSize()`:
  - `view: 'list'` → returns `3` (existing default behavior).
  - `view: 'time-grid'` → returns approximately the rendered card height in 50-px rows:
    ```ts
    const slotsPerHour = 60 / config.time_grid_interval_minutes;
    const gridPx = (config.time_grid_end_hour - config.time_grid_start_hour) * slotsPerHour * 24;  // 24 = default slot height
    const chromePx = 80;  // nav header + day headers
    return Math.ceil((gridPx + chromePx) / 50);
    ```
  For default 06–22 with 30-min interval: `(16 * 2 * 24 + 80) / 50 = 17 rows`. (Approximate; ignores all-day strip and now-line for simplicity.)
- **FR-10.2** `getGridOptions()` is **NOT** added in this PR. Without it, HA section-view defaults to full-width natural-height — fine for the time-grid view.

### FR-11: Performance
- **FR-11.1** List-view render path is byte-for-byte unchanged. Bundle-size delta target: ≤ +20 KB minified (current: 284 KB → cap 304 KB). Estimate breakdown: utils/grid.ts ~5 KB, render-grid.ts ~7 KB, calendar-card-pro.ts additions ~4 KB, editor additions ~2 KB, CSS additions ~2 KB.
- **FR-11.2** `ResizeObserver` re-renders are coalesced to one per animation frame.
- **FR-11.3** Now-line position updates are imperative (one DOM mutation per minute), not via Lit re-render.
- **FR-11.4** Now-line interval is started in `connectedCallback` when `view === 'time-grid'` and `time_grid_show_now_line` is true; stopped in `disconnectedCallback`. The `visibilitychange: 'hidden'` handler also stops it; `'visible'` restarts it. Each tick (every 60s) calls `_updateNowLinePosition`, which is a **no-op** when today is not in the visible window (per FR-2.10). The interval does not stop/start based on today visibility — that's a deferred optimization (low value: 1 wasted call/min when today is out of window).
- **FR-11.5** **Midnight refresh.** Without intervention, `ctx.now` (captured at render time) becomes stale at midnight: yesterday's column retains the `today` class until the next re-render trigger (config change, resize, navigation). v9 piggybacks on the now-line interval: each tick compares `startOfDay(new Date())` against the renderer's last-known "today" date (cached on the host as `_lastRenderDay`). If the local date has changed, the host calls `this.requestUpdate()` to force a re-render with the fresh `ctx.now`. This costs at most 1 wasted re-render per day. Implementation:
  ```ts
  private _lastRenderDay: number = 0;  // ms timestamp of startOfDay at last render
  // In _updateNowLinePosition tick (or a sibling tick at the same interval):
  const todayStart = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  if (todayStart !== this._lastRenderDay) {
    this._lastRenderDay = todayStart;
    this.requestUpdate();   // forces re-render; the new ctx.now updates today-class & day-headers
  }
  // Also set this._lastRenderDay in updated() after each render commits.
  ```
  When `view !== 'time-grid'` the timer isn't running, so list-view path is unaffected.

## 5. Configuration schema (additions only)

```ts
// In src/config/types.ts, Config interface, near `language?:`
view: 'list' | 'time-grid';                    // default 'list'

time_grid_start_hour: number;                  // 0..23, default 6
time_grid_end_hour: number;                    // 1..24, default 22
time_grid_interval_minutes: 15 | 30 | 60;      // default 30
time_grid_event_min_height_px: number;         // pixels, default 24
time_grid_max_days: 1 | 3 | 7;                 // default 7 — caps responsive N
time_grid_navigation_days: number;             // default 28 — fetch window for grid view
time_grid_show_now_line: boolean;              // default true
time_grid_allday_bg_opacity: number;           // 0..1, default 0.2 — banner background alpha
time_grid_breakpoint_three_day_px: number;     // default 500
time_grid_breakpoint_seven_day_px: number;     // default 900
```

**Naming rationale (revised in v3):**
- All fields prefixed `time_grid_*` to (a) avoid collisions with HA Lovelace `grid_options`, (b) leave room for future `month_grid_*`.
- `view` is unprefixed — top-level mode discriminator.
- `time_grid_navigation_days` is decoupled from `days_to_show`.
- **Breakpoints are flattened** to two top-level scalars (NOT a nested object) — avoids the shallow-merge data-loss bug at `calendar-card-pro.ts:482`. (See A8 / C-1.)
- `time_grid_event_min_height_px: number` (not `string`) — matches the helper signature `computeEventPlacement(..., minHeightPx: number)`. Editor uses a number input.

`hasConfigChanged()` reacts to **`time_grid_navigation_days`** in addition to existing fields.

## 6. Module design

### 6.1 New files

```
src/utils/grid.ts                 # Pure helpers
src/rendering/render-grid.ts      # Pure render functions
docs/design/time-grid-view.md     # This document
```

### 6.2 Modified files

```
src/config/types.ts               # +Config fields (all top-level scalars)
src/config/config.ts              # +DEFAULT_CONFIG entries; +hasConfigChanged update for time_grid_navigation_days
src/calendar-card-pro.ts          # +ResizeObserver, +offset state, +nav handlers, +render dispatch, +getCardSize, +visibility-change 'hidden' branch
src/utils/events.ts               # Add optional `effectiveDaysToShow?: number` arg to fetchEventData; use at 3 callsites (lines ~39, 61, 70)
src/rendering/styles.ts           # Append grid CSS section + new --calendar-card-grid-* properties
src/rendering/editor.ts           # +view selector + grid options panel
src/translations/languages/en.json  # +editor.* keys + nav button labels
docs/architecture.md              # Update directory tree
```

**Files explicitly NOT modified:** `src/rendering/render.ts` (list view path untouched).

### 6.3 `src/utils/grid.ts` — pure helpers (no DOM, no Lit)

```ts
import * as Types from '../config/types';

/** Fixed slot height in pixels — used consistently by renderer, host, and getCardSize.
 *  Not a CSS variable (avoids inconsistency between code paths). */
export const SLOT_HEIGHT_PX = 24;

/** Minutes since local midnight. */
export function minutesFromMidnight(d: Date): number;

/** Beginning of the day (00:00:00.000 local). */
export function startOfDay(d: Date): Date;

/** Whole-day difference between two Dates. Internally normalizes both with `startOfDay`,
 *  then returns `Math.round((b_local_midnight - a_local_midnight) / 1day)`.
 *  Round (not floor) is required to handle DST transitions correctly:
 *  spring-forward gives a 23-hour day (floor → 0, round → 1).
 *  Used for banner placement (eventStartDay - windowStart in days). */
export function daysBetween(a: Date, b: Date): number;

/** Adjust to start of week (Sun=0 or Mon=1). Returns a Date at local 00:00:00.000. */
export function startOfWeek(d: Date, firstDayOfWeek: 0 | 1): Date;

/** Build N consecutive day starts from `from`. Each returned Date is at local 00:00. */
export function buildDayWindow(from: Date, dayCount: number): Date[];

/** Snap reference + offset to a window of dayCount days, week-aligned when dayCount === 7.
 *  All returned Dates (start and each entry of days) are at local 00:00. */
export function snapToWindow(
  referenceDate: Date,
  offsetDays: number,
  dayCount: 1 | 3 | 7,
  firstDayOfWeek: 0 | 1,
): { start: Date; days: Date[] };

/** Choose visible-day count from observed width, breakpoints, and cap.
 *  When widthPx === 0 (parent not yet laid out / hidden tab), returns the cap (best guess)
 *  rather than 1, to avoid a flash of N=1 followed by N=cap on the first real measurement.
 *  A real but small measurement (e.g. width=49) returns N=1, not cap. */
export function chooseVisibleDays(
  widthPx: number,
  bpThreeDayPx: number,
  bpSevenDayPx: number,
  cap: 1 | 3 | 7,
): 1 | 3 | 7;

export interface EventPlacement {
  topPx: number;
  heightPx: number;
  clippedTop: boolean;
  clippedBottom: boolean;
  outsideRange: boolean;
}

/** Compute placement for one timed event. */
export function computeEventPlacement(
  startMin: number, endMin: number,
  gridStartMin: number, gridEndMin: number,
  slotHeightPx: number, intervalMin: number,
  minHeightPx: number,
): EventPlacement;

/** Cluster-based overlap layout. Sorts events internally if not sorted by startMin. */
export function layoutOverlaps<T extends { startMin: number; endMin: number }>(
  events: T[],
): Array<T & { laneIndex: number; laneCount: number }>;

/** Split a timed event that crosses midnight into per-day timed segments.
 *  Drops zero-duration segments (e.g., events ending exactly at midnight). */
export function splitTimedEventByDay(
  event: Types.CalendarEventData,
  windowStart: Date, windowEnd: Date,
): Types.CalendarEventData[];

/** Reference date for grid view. Replicates events.ts:getStartDateReference logic
 *  via the public getTimeWindow. Returns a Date at local 00:00:00.000 (midnight-normalized). */
export function getReferenceDate(
  config: Pick<Types.Config, 'start_date' | 'days_to_show'>,
): Date;

/** Detect if an event has ended relative to `now`. Replicates render.ts:isPastEvent semantics. */
export function isPastEvent(event: Types.CalendarEventData, now: Date): boolean;

/** Format an hour-only label for the time-axis. Use24h `true` returns "0".."23";
 *  false returns "12 AM", "1 AM", …, "11 PM". Used by render-grid.ts for axis labels. */
export function formatHourLabel(hour: number, use24h: boolean): string;
```

All functions are pure. The duplication of `getReferenceDate` and `isPastEvent` (per A30) is deliberate to avoid touching `events.ts` and `render.ts`.

### 6.4 `src/rendering/render-grid.ts`

```ts
export function renderTimeGrid(
  events: ReadonlyArray<Types.CalendarEventData>,
  config: Types.Config,
  language: string,
  ctx: TimeGridContext,
  hass?: Types.Hass | null,
): TemplateResult;

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
```

Internal flow:
1. Compute visible-day window via `snapToWindow`.
2. Filter events to the window; split timed events crossing midnight via `splitTimedEventByDay`.
3. Bucket into all-day banners vs timed-by-column.
4. For each column: `computeEventPlacement` per event, then `layoutOverlaps`.
5. Determine if today is in `ctx.days`; cache the today-column index.
6. Emit Lit `html` template:
   ```html
   <div class="ccp-grid">
     <div class="ccp-grid-nav">… buttons + range label …</div>
     <div class="ccp-grid-headers"
          style=${styleMap({'grid-template-columns': `var(--calendar-card-grid-time-axis-width, 48px) repeat(${visibleDays},1fr)`})}>
       <div class="ccp-grid-axis-spacer"></div>
       <!-- one header cell per visible day -->
       <div class="ccp-grid-day-header">… weekday + day-of-month …</div>
       …
     </div>
     <div class="ccp-grid-allday"
          style=${styleMap({'grid-template-columns': `var(--calendar-card-grid-time-axis-width, 48px) repeat(${visibleDays},1fr)`})}>
       <div class="ccp-grid-axis-spacer"></div>
       <!-- per banner: -->
       <div class="ccp-grid-allday-banner"
            style=${styleMap({
              'grid-column-start': String(dayIdx + 2),       // +2 because axis is column 1
              'grid-column-end': `span ${numDays}`,
              'background-color': accentWithOpacity,         // accent at time_grid_allday_bg_opacity (default 0.2)
            })}>
         … banner content …
       </div>
       …
     </div>
     <div class="ccp-grid-body">
       <div class="ccp-grid-time-axis">
         <!-- one absolute-positioned hour label per hour in [start, end-1] -->
         <span class="ccp-grid-hour-label"
               style=${styleMap({top: `${(hour - startHour) * slotsPerHour * SLOT_HEIGHT_PX}px`})}>
           ${formatHourLabel(hour, use24h)}
         </span>
         …
       </div>
       <div class="ccp-grid-columns"
            style=${styleMap({'grid-template-columns': `repeat(${visibleDays},1fr)`})}>
         <div class="ccp-grid-day-column ${i === todayIdx ? 'today' : ''}">
           <div class="ccp-grid-event"
                style=${styleMap({top:'168px', height:'72px', left:'0%', width:'50%'})}>
             … event content …
           </div>
           …
           ${i === todayIdx
              ? html`<div class="ccp-grid-now-line"></div>`
              : nothing}
         </div>
         …
       </div>
     </div>
   </div>
   ```

The now-line element is rendered **only** in the today day-column (per FR-2.10 and C-4 fix). Per-event positioning is inline via `styleMap`.

### 6.5 `src/calendar-card-pro.ts` modifications

New reactive state:
- `@property({ attribute: false }) viewOffsetDays = 0;`
- `@property({ attribute: false }) visibleDays: 1 | 3 | 7 = 7;` *(initial value; corrected in `connectedCallback`)*

New private state:
- `private _resizeObserver?: ResizeObserver;`
- `private _resizeRafId?: number;`
- `private _nowLineIntervalId?: number;`
- `private _lastRenderDay = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();` — initialized to today's local midnight at construction time. Avoids spurious `requestUpdate` on first `_updateNowLinePosition` tick.

**Lifecycle (single source of truth: `_syncObserver()`):**

```ts
private _syncObserver(): void {
  const wantObserver = this.config.view === 'time-grid' && this.isConnected;
  if (wantObserver && !this._resizeObserver) {
    this._resizeObserver = new ResizeObserver((entries) => this._onResize(entries));
    this._resizeObserver.observe(this);
  } else if (!wantObserver && this._resizeObserver) {
    this._resizeObserver.disconnect();
    this._resizeObserver = undefined;
  }
}

private _onResize(entries: ResizeObserverEntry[]): void {
  if (this._resizeRafId !== undefined) return;
  this._resizeRafId = requestAnimationFrame(() => {
    this._resizeRafId = undefined;
    const widthPx = entries[0]?.contentBoxSize?.[0]?.inlineSize
                  ?? entries[0]?.contentRect.width
                  ?? this.offsetWidth;
    this._applyVisibleDays(widthPx);
  });
}

private _applyVisibleDays(widthPx: number): void {
  const next = Grid.chooseVisibleDays(
    widthPx,
    this.config.time_grid_breakpoint_three_day_px,
    this.config.time_grid_breakpoint_seven_day_px,
    this.config.time_grid_max_days,
  );
  if (next !== this.visibleDays) this.visibleDays = next;
}
```

`connectedCallback` (additions, after `super.connectedCallback()`):

```ts
this._syncObserver();
if (this.config.view === 'time-grid') {
  // Read offsetWidth synchronously to seed visibleDays before first render.
  // Lit schedules the first render in a microtask after connectedCallback returns,
  // so setting the property here takes effect on the first render. Reading
  // offsetWidth forces a layout pass, returning a valid width.
  this._applyVisibleDays(this.offsetWidth);
  if (this.config.time_grid_show_now_line) this._startNowLine();
}
```

`disconnectedCallback` (additions):

```ts
this._resizeObserver?.disconnect();
this._resizeObserver = undefined;
if (this._resizeRafId !== undefined) cancelAnimationFrame(this._resizeRafId);
this._stopNowLine();
```

`updated(changedProps)`:

```ts
// (existing logic stays)
if (changedProps.has('config')) {
  const prev = changedProps.get('config') as Types.Config | undefined;
  if (prev?.view !== this.config.view) {
    this._syncObserver();
    this._stopNowLine();
    if (this.config.view === 'time-grid') {
      this._applyVisibleDays(this.offsetWidth);
      if (this.config.time_grid_show_now_line) this._startNowLine();
    }
  }
}
```

**Visibility change handler** (extend the existing `_handleVisibilityChange`):

```ts
private _handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    // existing data-refresh logic stays
    const now = Date.now();
    if (now - this._lastUpdateTime > Constants.TIMING.VISIBILITY_REFRESH_THRESHOLD) {
      Logger.debug('Visibility changed to visible, updating events');
      this.updateEvents();
    }
    // NEW: restart now-line if it should be running
    if (this.config?.view === 'time-grid' && this.config.time_grid_show_now_line) {
      this._startNowLine();
    }
  } else if (document.visibilityState === 'hidden') {
    // NEW: pause now-line interval to avoid background work
    this._stopNowLine();
  }
};
```

**Now-line interval (imperative position update):**

```ts
private _startNowLine(): void {
  if (this._nowLineIntervalId !== undefined) return;
  this._updateNowLinePosition();
  this._nowLineIntervalId = window.setInterval(() => this._updateNowLinePosition(), 60_000);
}

private _stopNowLine(): void {
  if (this._nowLineIntervalId !== undefined) {
    clearInterval(this._nowLineIntervalId);
    this._nowLineIntervalId = undefined;
  }
}

private _updateNowLinePosition(): void {
  // (1) Midnight detection — runs FIRST, before any early returns. This must fire
  // even when today is currently out of the visible window (e.g., user has navigated
  // forward); otherwise stale "today" state persists. See FR-11.5.
  const todayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  if (todayStart !== this._lastRenderDay) {
    this._lastRenderDay = todayStart;
    this.requestUpdate();   // forces a re-render with fresh ctx.now
    return;                  // re-render will re-invoke us via updated() if needed
  }

  // (2) Now-line position update (only if today is currently in the visible window).
  const lineEl = this.renderRoot.querySelector<HTMLElement>(
    '.ccp-grid-day-column.today .ccp-grid-now-line',
  );
  if (!lineEl) return;  // today not visible OR view is not time-grid
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const gridStart = this.config.time_grid_start_hour * 60;
  const gridEnd = this.config.time_grid_end_hour * 60;
  const slotHeight = Grid.SLOT_HEIGHT_PX;  // code constant, not CSS variable
  const interval = this.config.time_grid_interval_minutes;
  if (minutes < gridStart || minutes > gridEnd) {
    lineEl.style.display = 'none';
    return;
  }
  lineEl.style.display = '';
  lineEl.style.top = `${(minutes - gridStart) / interval * slotHeight}px`;
}
```

**Render dispatch** (in `render()`, after the existing loading/error guards):

The existing `render()` method (`calendar-card-pro.ts:586-632`) has 4 branches in order: `isInitialLoad` → `!safeHass || !entities.length` → `events.length === 0` → normal. The grid view branch is inserted **after the error checks but before the empty-events check**:

```ts
if (this.isInitialLoad) {
  content = Render.renderCardContent('loading', this.effectiveLanguage);
} else if (!this.safeHass || !this.config.entities.length) {
  content = Render.renderCardContent('error', this.effectiveLanguage);
} else if (this.config.view === 'time-grid') {                      // NEW BRANCH
  content = RenderGrid.renderTimeGrid(
    this.events, this.config, this.effectiveLanguage,
    {
      visibleDays: this.visibleDays,
      offsetDays: this.viewOffsetDays,
      now: new Date(),
      onShiftDay: (d) => this._shiftDays(d),
      onShiftWindow: (d) => this._shiftDays(d * this.visibleDays),
      onResetToToday: () => { this.viewOffsetDays = this._todayOffset(); },
      canShiftBack: this.viewOffsetDays > 0,
      canShiftForward: this.viewOffsetDays < this._maxOffset(),
    },
    this.safeHass,
  );
} else if (this.events.length === 0) {
  // existing list-view empty branch — unchanged
} else {
  // existing list-view normal branch — unchanged
}
```

`_shiftDays`, `_maxOffset`, and `_todayOffset`:

```ts
private _maxOffset(): number {
  return Math.max(0, this.config.time_grid_navigation_days - this.visibleDays);
}

private _shiftDays(delta: number): void {
  const next = this.viewOffsetDays + delta;
  this.viewOffsetDays = Math.max(0, Math.min(this._maxOffset(), next));
}

/** Today's offset within the fetch window (referenceDate-relative). Clamped. */
private _todayOffset(): number {
  const reference = Grid.getReferenceDate(this.config);  // start of fetch window
  const today = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const diffDays = Math.round((today.getTime() - reference.getTime()) / (24 * 3600 * 1000));
  return Math.max(0, Math.min(this._maxOffset(), diffDays));
}
```

**`getCardSize` (FR-10.1):**

```ts
public getCardSize(): number {
  if (this.config.view === 'time-grid') {
    const slotsPerHour = 60 / this.config.time_grid_interval_minutes;
    const slotPx = Grid.SLOT_HEIGHT_PX;  // code constant; same as renderer + now-line use
    const gridPx = (this.config.time_grid_end_hour - this.config.time_grid_start_hour)
                 * slotsPerHour * slotPx;
    const chromePx = 80;  // nav header + day headers (approximation)
    let totalPx = gridPx + chromePx;

    // Best-effort clamp to max_height if it's a px value (other units like vh, calc not handled).
    const mh = this.config.max_height;
    if (mh && mh !== 'none' && mh.endsWith('px')) {
      const mhPx = parseFloat(mh);
      if (!isNaN(mhPx)) totalPx = Math.min(totalPx, mhPx);
    }

    return Math.max(1, Math.ceil(totalPx / 50));
  }
  return 3;
}
```

**`setConfig` change for FR-5.4:** add an optional `effectiveDaysToShow` argument to `EventUtils.fetchEventData`. The grid view passes `time_grid_navigation_days`; the list view passes `undefined` (uses `config.days_to_show` as today). Inside `fetchEventData`:

```ts
export async function fetchEventData(
  hass: Types.Hass,
  config: Types.Config,
  instanceId: string,
  force = false,
  effectiveDaysToShow?: number,    // NEW
): Promise<Types.CalendarEventData[]> {
  const daysToShow = effectiveDaysToShow ?? config.days_to_show;

  const cacheKey = getBaseCacheKey(
    instanceId, config.entities, daysToShow,    // CHANGED
    config.show_past_events, config.start_date, config.filter_duplicates,
  );
  // ... same caching logic ...

  const timeWindow = getTimeWindow(daysToShow, config.start_date);   // CHANGED
  // ... same fetch ...

  const limitDate = new Date(referenceDate);
  limitDate.setDate(limitDate.getDate() + daysToShow);                // CHANGED
  // ... same filter ...
}
```

The list view path is unaffected (calls `fetchEventData(hass, config, instanceId, force)` — fourth arg unchanged).

**Host-side caller change** (in `calendar-card-pro.ts:538` inside `updateEvents`): the host MUST pass the override when grid view is active. Without this change, the entire fetch-window decoupling above is dormant.

```ts
// In updateEvents, before calling fetchEventData:
const effectiveDays = this.config.view === 'time-grid'
  ? this.config.time_grid_navigation_days
  : undefined;

const eventData = await EventUtils.fetchEventData(
  this.safeHass,
  this.config,
  this._instanceId,
  force,
  effectiveDays,   // NEW — undefined for list view (preserves existing behavior)
);
```

### 6.6 Styles

Appended to `src/rendering/styles.ts`. All new selectors are scoped to `.ccp-grid*`.

```css
/* ===== Time-grid view ===== */
.ccp-grid {
  display: flex;
  flex-direction: column;
  /* No overflow-y here: the existing .content-container parent already provides
     scroll behavior via 'overflow-y: auto' (see styles.ts). Adding it here would
     create nested scroll containers (touch-scroll fights). */
}

.ccp-grid-nav {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 8px;
}
.ccp-grid-nav button {
  background: transparent; border: 0; cursor: pointer;
  padding: 4px 8px; border-radius: 4px;
  color: var(--calendar-card-color-event);
}
.ccp-grid-nav button[aria-disabled="true"] { opacity: 0.4; cursor: not-allowed; }
.ccp-grid-nav button:focus-visible {
  outline: 2px solid var(--calendar-card-line-color-vertical);
}
.ccp-grid-range { margin-left: auto; font-size: var(--calendar-card-font-size-event); }

/* grid-template-columns set inline via styleMap by the renderer */
.ccp-grid-headers, .ccp-grid-allday {
  display: grid;
}

/* The body is itself a 2-column grid: time-axis | columns-area.
   This guarantees the day-columns area aligns horizontally with the headers' day cells,
   since both use the same time-axis-width as their leading column. */
.ccp-grid-body {
  display: grid;
  grid-template-columns: var(--calendar-card-grid-time-axis-width, 48px) 1fr;
}

.ccp-grid-columns {
  display: grid;
  /* grid-template-columns: repeat(N, 1fr) — set inline via styleMap */
}

.ccp-grid-day-column {
  position: relative;
  border-left: 1px solid var(--calendar-card-day-separator-color, transparent);
  min-height: 24px;
}

.ccp-grid-time-axis {
  font-size: var(--calendar-card-font-size-time);
  /* Hour labels positioned absolutely, top: <hour-offset>px, by the renderer.
     Container itself fills its grid cell. */
  position: relative;
}

.ccp-grid-allday {
  max-height: var(--calendar-card-grid-allday-max-height, 6em);
  overflow: hidden;
}
.ccp-grid-allday-banner {
  border-radius: var(--calendar-card-grid-event-radius, 4px);
  padding: 2px 6px; margin: 1px;
  /* background-color set inline via styleMap (accent at event_background_opacity);
     grid-column-start / grid-column-end also set inline */
  border-inline-start: 2px solid var(--calendar-card-line-color-vertical);
}

.ccp-grid-event {
  position: absolute;
  /* top, height, left, width set inline via styleMap */
  border-inline-start: 2px solid var(--calendar-card-line-color-vertical);
  background: var(--calendar-card-line-color-vertical);
  border-radius: var(--calendar-card-grid-event-radius, 4px);
  font-size: var(--calendar-card-font-size-event);
  overflow: hidden;
}
.ccp-grid-event.past-event { opacity: 0.55; }

.ccp-grid-now-line {
  position: absolute;
  left: 0; right: 0;     /* NB: positioning context is the today day-column, not body */
  height: 2px;
  background: var(--calendar-card-grid-now-line-color, var(--calendar-card-line-color-vertical));
  pointer-events: none;
  z-index: 1;
}

.ccp-grid-hidden-pill {
  position: absolute; top: 2px; left: 2px; right: 2px;
  font-size: 10px; opacity: 0.7; text-align: center;
}
```

The now-line's `left: 0; right: 0` correctly spans only its parent (`.ccp-grid-day-column.today`), since that's the absolute-positioning context.

**Layout summary** (resolves F-1):
- `.ccp-grid` — vertical flex container; the whole grid scrolls if `max_height` is set.
- `.ccp-grid-nav` — flex row above everything.
- `.ccp-grid-headers` — CSS grid: `[axis-width] [N day cells]` (inline `grid-template-columns`).
- `.ccp-grid-allday` — CSS grid: same template as headers; banners use `grid-column-start: <dayIdx + 2>; grid-column-end: span <numDays>`.
- `.ccp-grid-body` — CSS grid: `[axis-width] [1fr]`. Two cells: time-axis on left, columns-area on right.
- `.ccp-grid-time-axis` — fills body cell 1; hour labels are absolutely positioned at `top: <(hour - gridStartHour) * slotsPerHour * SLOT_HEIGHT_PX>px`.
- `.ccp-grid-columns` — fills body cell 2; itself a CSS grid with `repeat(N, 1fr)`.
- `.ccp-grid-day-column` — relative-positioned cell; events absolute-positioned inside.

### 6.7 Event splitting and grouping

Grid view always splits multi-day events at midnight via `splitTimedEventByDay` in `utils/grid.ts`. Differences from `events.ts:splitMultiDayEvent` (which we do **not** reuse):
1. Middle days remain timed (00:00–24:00), not all-day segments.
2. Zero-duration segments (events ending exactly at midnight) are dropped.

`groupEventsByDay()` is bypassed entirely (it injects `_isEmptyDay` synthetic events).

Reference date and past-event detection are replicated in `utils/grid.ts` to avoid touching `events.ts` and `render.ts`.

## 7. Interaction with existing features

| Existing feature | Interaction |
|---|---|
| `days_to_show` | **Hidden** in editor when `view: time-grid` (grid view uses `time_grid_navigation_days` instead). `hasConfigChanged` ignores `days_to_show` mutations when `view: time-grid` (avoids wasted refetches). YAML users can still set it; it just has no effect on grid view. |
| `compact_events_to_show` / `compact_days_to_show` | Not applied in grid view. Editor hides them when `view = time-grid`. |
| `show_empty_days` | Not applied. Grid always shows N columns. |
| `show_week_numbers` | Not applied (visual conflict with column layout). Deferred. |
| `today_indicator` | **Not currently applied** in grid view. Today is highlighted via (a) the now-line on today's column, and (b) a `today` class on today's day-column header (CSS bold + accent border). The list-view-specific `today_indicator` styles (`dot`, `pulse`, etc.) are unrelated to grid layout. May be revisited in a follow-up if users request it. |
| `tap_action` / `hold_action` | Bypassed inside nav buttons (`stopPropagation`). Other parts of the grid still respect card-level actions. **`tap_action: 'expand'`** (default for compact mode in list view) is a **no-op** in grid view because `isExpanded` only affects list-view's compact-mode behavior. Users with this action set will see no visible change on tap; documented in README. |
| `weather` | **Deferred entirely in v1**: weather forecasts are not shown in grid view (neither in banners nor timed events). Adding weather is a follow-up feature; existing list-view weather logic is too tightly coupled to per-event title-rendering to reuse cleanly. |
| `refresh_interval` | Unchanged — periodic refetch refreshes the in-memory `events` array, which the grid then re-renders. |
| `card-mod` | Grid uses CSS classes prefixed `ccp-grid-*`. **Card-mod note:** the now-line position is updated imperatively (not via Lit re-render), so card-mod users targeting `.ccp-grid-now-line` will see their CSS preserved across updates. Other DOM mutations made by card-mod *will* be replaced on Lit re-renders, same as today. |
| `split_multiday_events` (config) | Ignored in grid view (always splits). |

## 8. Acceptance criteria as test specs (Given/When/Then)

```
Spec G-1.4 (FR-1.4 invalid view value):
  GIVEN setConfig({ view: 'foobar' })
  WHEN config is merged
  THEN config.view === 'list'
   AND a Logger.warn was emitted

Spec G-2.7a (banner placement, fully within window):
  GIVEN visible window May 11-17 (7 days, dayIdx 0-6)
   AND  all-day event from May 13 to May 16 (4-day span; iCal end May 17 exclusive becomes May 16 inclusive)
  WHEN renderTimeGrid computes banner placement
  THEN dayIdx === 2 (May 13 is the 3rd visible day, 0-indexed)
   AND numDays === 4 (May 13, 14, 15, 16)
   AND grid-column-start: 4 (= dayIdx + 2; column 1 is axis, column 2 is May 11)
   AND grid-column-end: span 4
   AND no ◂ or ▸ indicator

Spec G-2.7b (banner clipped at start):
  GIVEN visible window May 11-17
   AND  all-day event from May 09 to May 13 (started before window)
  WHEN banner placement is computed
  THEN dayIdx === 0 (clamped to window start)
   AND numDays === 3 (May 11, 12, 13 — visible portion)
   AND ◂ indicator prepended to banner content

Spec G-2.7c (banner clipped at end):
  GIVEN visible window May 11-17
   AND  all-day event from May 16 to May 20 (extends after window)
  WHEN banner placement is computed
  THEN dayIdx === 5 (May 16 is 6th visible day)
   AND numDays === 2 (May 16, 17 — visible portion)
   AND ▸ indicator appended to banner content

Spec G-2.7d (banner spans entire window):
  GIVEN visible window May 11-17 (7 days)
   AND  all-day event from May 09 to May 20
  WHEN banner placement is computed
  THEN dayIdx === 0
   AND numDays === 7 (entire visible window)
   AND both ◂ and ▸ indicators

Spec G-2.5 (FR-2.5 event placement, in-bounds):
  GIVEN slotHeight=24, intervalMin=30, gridStartMin=360, gridEndMin=1320,
        event 09:30 to 11:00, minHeight=24
  WHEN computeEventPlacement is called
  THEN topPx === 168, heightPx === 72
   AND clippedTop === false, clippedBottom === false, outsideRange === false

Spec G-2.5b (minHeight enforcement):
  GIVEN event 10:00 to 10:05, minHeight=24
  WHEN computeEventPlacement is called
  THEN heightPx === 24 (clamped)

Spec G-2.6a (clipped-top):
  GIVEN event 04:00 to 07:00, grid 06:00-22:00
  WHEN computeEventPlacement is called
  THEN topPx === 0, heightPx === 48
   AND clippedTop === true, clippedBottom === false, outsideRange === false

Spec G-2.6b (clipped-bottom):
  GIVEN event 21:00 to 23:30, grid 06:00-22:00
  WHEN computeEventPlacement is called
  THEN topPx === 720, heightPx === 48
   AND clippedBottom === true

Spec G-2.6c (outside before):
  GIVEN event 02:00 to 05:00, grid 06:00-22:00
  WHEN computeEventPlacement is called
  THEN outsideRange === true

Spec G-2.6d (outside after):
  GIVEN event 23:00 to 23:45, grid 06:00-22:00
  WHEN computeEventPlacement is called
  THEN outsideRange === true

Spec G-2.6e (defensive: end <= start):
  GIVEN event 11:00 to 09:00 (malformed: endMin <= startMin)
  WHEN computeEventPlacement is called
  THEN outsideRange === true (graceful handling per FR-2.5 defensive guard)

Spec G-2.6f (defensive: end == start, zero duration):
  GIVEN event 10:00 to 10:00
  WHEN computeEventPlacement is called
  THEN outsideRange === true

Spec G-hours (FR-2.3 invalid hour-range coercion):
  GIVEN setConfig({ time_grid_start_hour: 25, time_grid_end_hour: 22 })
  WHEN config is merged
  THEN config.time_grid_start_hour === 6  // reset to default
   AND config.time_grid_end_hour === 22   // reset to default
   AND a Logger.warn was emitted

  GIVEN setConfig({ time_grid_start_hour: 22, time_grid_end_hour: 6 })  // start >= end
  WHEN config is merged
  THEN config.time_grid_start_hour === 6, time_grid_end_hour === 22
   AND a Logger.warn was emitted

Spec G-2.8a (split timed event by day, no zero segments):
  GIVEN event 2026-05-13 22:00 to 2026-05-15 02:00
  WHEN splitTimedEventByDay(event, 05-13, 05-16) is called
  THEN three TIMED segments (no { date: ... }):
       seg[0]: 05-13 22:00 → 05-14 00:00
       seg[1]: 05-14 00:00 → 05-15 00:00
       seg[2]: 05-15 00:00 → 05-15 02:00

Spec G-2.8b (event ending exactly at midnight):
  GIVEN event 2026-05-13 22:00 to 2026-05-14 00:00
  WHEN splitTimedEventByDay(event, 05-13, 05-15) is called
  THEN one segment only (no zero-duration second segment):
       seg[0]: 05-13 22:00 → 05-14 00:00

Spec G-2.9 (cluster of three pairwise overlapping):
  GIVEN A=09:00-10:00, B=09:30-10:30, C=09:45-10:15
  WHEN layoutOverlaps is called
  THEN each event has laneCount === 3
   AND laneIndex values are 0, 1, 2 (start order)

Spec G-2.9b (sequential, half-open intervals):
  GIVEN A=09:00-10:00, B=10:00-11:00 (touch)
  WHEN layoutOverlaps is called
  THEN each event has laneCount === 1

Spec G-2.9c (disconnected clusters):
  GIVEN A=09:00-10:00, B=09:30-10:30, C=14:00-15:00
  WHEN layoutOverlaps is called
  THEN A.laneCount === 2, B.laneCount === 2 (cluster 1)
   AND C.laneCount === 1 (cluster 2)

Spec G-2.9d (transitive overlap, fewer simultaneous):
  GIVEN A=09:00-09:30, B=09:15-10:00, C=09:45-10:15
  WHEN layoutOverlaps is called
  THEN all share laneCount === 2 (max simultaneous in cluster)
   AND A.lane=0, B.lane=1, C.lane=0 (greedy reuse of A's lane)

Spec G-2.9e (unsorted input):
  GIVEN events in non-start-time order
  WHEN layoutOverlaps is called
  THEN function sorts internally and produces same result as G-2.9

Spec G-2.12 (empty events):
  GIVEN events = [], view = 'time-grid'
  WHEN renderTimeGrid is called
  THEN output contains nav bar, headers, time axis (no banners, no event blocks)
   AND now-line element is present iff today is in the visible window

Spec G-3.1 (responsive selection):
  GIVEN bp_three=500, bp_seven=900, cap=7
  WHEN chooseVisibleDays(499) THEN result === 1
  WHEN chooseVisibleDays(500) THEN result === 3
  WHEN chooseVisibleDays(899) THEN result === 3
  WHEN chooseVisibleDays(900) THEN result === 7
  WHEN cap=3 AND chooseVisibleDays(2000) THEN result === 3
  WHEN cap=1 AND chooseVisibleDays(2000) THEN result === 1

Spec G-3.1b (no-measurement fallback):
  GIVEN bp_three=500, bp_seven=900, cap=7
  WHEN chooseVisibleDays(0) THEN result === 7  // no measurement -> cap
  WHEN chooseVisibleDays(1) THEN result === 1  // real measurement, very narrow
  WHEN chooseVisibleDays(49) THEN result === 1  // real measurement, narrow widget
  WHEN chooseVisibleDays(499) THEN result === 1
  WHEN chooseVisibleDays(500) THEN result === 3

Spec G-Today (FR-5.3 Today button when start_date != today):
  GIVEN config.start_date = '-7' (today minus 7 days)
   AND  time_grid_navigation_days = 28
   AND  visibleDays = 7
   AND  user has navigated forward, viewOffsetDays = 14
  WHEN onResetToToday is called
  THEN viewOffsetDays === 7  // _todayOffset() = (today - reference) / 1day = 7
  AND  the visible window (after snapToWindow) contains today

Spec G-5.1 (week alignment for 7 days):
  GIVEN reference Wed 2026-05-13 at 00:00 local, firstDayOfWeek=1 (Mon), offset=0
  WHEN snapToWindow(reference, 0, 7, 1) is called
  THEN result.start === Mon 2026-05-11 at 00:00 local
   AND result.days has length 7
   AND every day in result.days is at 00:00 local

Spec G-5.1b (already aligned):
  GIVEN reference Mon 2026-05-11 at 00:00 local, firstDayOfWeek=1, offset=0
  WHEN snapToWindow(reference, 0, 7, 1) is called
  THEN result.start === Mon 2026-05-11 at 00:00 local

Spec G-5.2 (rolling for 3 days):
  GIVEN reference Wed 2026-05-13 at 00:00 local, offset=2
  WHEN snapToWindow(reference, 2, 3, 1) is called
  THEN result.start === Fri 2026-05-15 at 00:00 local

Spec G-5.4 (navigation range decoupled):
  GIVEN view='time-grid', days_to_show=3, time_grid_navigation_days=28
  WHEN setConfig is called and fetchEventData is invoked
  THEN the time window passed to fetch covers 28 calendar days starting from reference

Spec G-4.4 (navigation clamping — tests the underlying `_shiftDays` method;
            the +1/-1 buttons are only visible in N=3 mode per FR-4.1):
  GIVEN time_grid_navigation_days=28, visibleDays=7, current offset=21
  WHEN _shiftDays(+7) is called
  THEN viewOffsetDays === 21 (clamped: max = 28-7 = 21)
   AND _shiftDays(-7) sets it to 14
   AND _shiftDays(+1) is a no-op (still clamped at 21)

Spec G-2.10 (now-line position math):
  GIVEN now=14:30 local, gridStartMin=360, slot=24, interval=30
  WHEN _updateNowLinePosition computes top
  THEN top === '408px'

Spec G-2.10b (now-line out-of-range):
  GIVEN now=23:30 local, gridStartMin=360, gridEndMin=1320
  WHEN _updateNowLinePosition is called
  THEN line element.style.display === 'none'

Spec G-isPast (utils/grid.ts:isPastEvent):
  GIVEN now=2026-05-13 12:00, event 2026-05-13 09:00-11:00
  WHEN isPastEvent is called THEN true
  GIVEN same now, event 2026-05-13 13:00-14:00 THEN false
  GIVEN same now, all-day event {start:'2026-05-12', end:'2026-05-13'}
  WHEN isPastEvent is called
  THEN true  // because endDate after exclusive-adjustment is 05-12 midnight,
             // and (today=05-13 midnight) > (endDate=05-12 midnight) === true

Spec G-hourLabel (utils/grid.ts:formatHourLabel):
  WHEN formatHourLabel(0, true) THEN "0"
  WHEN formatHourLabel(13, true) THEN "13"
  WHEN formatHourLabel(0, false) THEN "12 AM"
  WHEN formatHourLabel(11, false) THEN "11 AM"
  WHEN formatHourLabel(12, false) THEN "12 PM"
  WHEN formatHourLabel(23, false) THEN "11 PM"

Spec G-hourLabelRange (FR-2.4 hour-label range):
  GIVEN time_grid_start_hour=6, time_grid_end_hour=22
  WHEN renderTimeGrid emits hour labels
  THEN labels exist at hours [6, 7, 8, ..., 21] (16 labels total)
   AND no label at hour 22 (the bottom edge)

Spec G-midnightRefresh (FR-11.5 — manual / integration test):
  GIVEN view='time-grid', card has rendered with ctx.now = 2026-05-13 23:59
   AND  _lastRenderDay is set to startOfDay(2026-05-13)
  WHEN clock advances to 2026-05-14 00:00
   AND  the now-line interval ticks
  THEN _lastRenderDay !== startOfDay(2026-05-14) (different ms timestamp)
   AND requestUpdate() is called
   AND on re-render, ctx.now is fresh and "today" class moves to the new day-column

Spec G-hasConfigChanged (FR-5.5 view-aware refetch logic):
  GIVEN previous = {view: 'list', days_to_show: 3, time_grid_navigation_days: 28, ...other defaults}
   AND  current = {view: 'time-grid', days_to_show: 3, time_grid_navigation_days: 28, ...same}
  WHEN hasConfigChanged is called
  THEN result === true  // viewChanged: list↔grid

  GIVEN previous = {view: 'time-grid', days_to_show: 3, ...}
   AND  current = {view: 'time-grid', days_to_show: 5, ...}
  WHEN hasConfigChanged is called
  THEN result === false  // grid view ignores days_to_show

  GIVEN previous = {view: 'list', days_to_show: 3, ...}
   AND  current = {view: 'list', days_to_show: 5, ...}
  WHEN hasConfigChanged is called
  THEN result === true  // list view: days_to_show triggers refetch

  GIVEN previous = {view: 'list', time_grid_navigation_days: 28, ...}
   AND  current = {view: 'list', time_grid_navigation_days: 14, ...}
  WHEN hasConfigChanged is called
  THEN result === false  // list view ignores time_grid_navigation_days

  GIVEN previous = {view: 'time-grid', time_grid_navigation_days: 28, ...}
   AND  current = {view: 'time-grid', time_grid_navigation_days: 14, ...}
  WHEN hasConfigChanged is called
  THEN result === true  // grid view: nav_days triggers refetch

Spec G-pastEventsFilter (FR-2.11 show_past_events):
  GIVEN today = 2026-05-13 14:00, visible window = May 11-17 (covers past_allday + past_timed days)
   AND  config.show_past_events = false
   AND  events = [
         past_timed: 2026-05-12 10:00-11:00 (timed, ENDED before now, in window),
         past_allday: {start:'2026-05-12', end:'2026-05-13'} (all-day, ENDED, in window),
         today_event: 2026-05-13 16:00-17:00 (in window, future relative to now),
         future_event: 2026-05-14 09:00-10:00 (in window, future)
        ]
  WHEN renderTimeGrid runs
  THEN past_timed is NOT in the rendered output (filtered per FR-2.11)
   AND past_allday IS in the rendered output (banner with past-event class for dimming)
   AND today_event and future_event render normally

  GIVEN config.show_past_events = true (default behavior preserved)
   AND  same setup
  WHEN renderTimeGrid runs
  THEN ALL four events render (timed past dimmed via past-event class)

Spec G-getCardSize (FR-10.1):
  WHEN config.view='list' THEN getCardSize() === 3
  WHEN config = {view:'time-grid', start_hour:6, end_hour:22, interval:30}
   THEN getCardSize() === 17  // ceil((16*2*24 + 80) / 50) = ceil(848/50) = ceil(16.96)
  WHEN config = above + max_height='400px'
   THEN getCardSize() === 8   // ceil(400 / 50) = 8
  WHEN config = {view:'time-grid', start_hour:0, end_hour:24, interval:60}
   THEN getCardSize() === 14  // ceil((24*1*24 + 80) / 50) = ceil(656/50) = ceil(13.12)

Spec G-getRefDate (utils/grid.ts:getReferenceDate):
  - undefined start_date → today midnight
  - 'YYYY-MM-DD' → that date midnight
  - 'today+5' → today+5 midnight
  - '+5' → today+5 midnight
```

## 9. Risks and mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | DST-crossing events mis-render duration (rare; only events that span the 02:00→03:00 spring-forward) | Low | Low | Spec for an event crossing spring-forward boundary; document local-tz behavior |
| R-2 | Initial width measurement returns 0 if connectedCallback fires before parent layout | Low | Low | `this.offsetWidth` forces synchronous layout. Worst case: brief layout flash on the first frame |
| R-3 | Existing list view regresses due to shared style additions | Low | High | New CSS scoped to `.ccp-grid*`; no existing rule modified; code review |
| R-4 | Editor breaks YAML-only configs | Very Low | Low | New fields are optional; `setConfig` merges defaults; **breakpoints flattened to scalars** to avoid shallow-merge data loss (C-1) |
| R-5 | Bundle size inflation | Low | Low | Track `dist/calendar-card-pro.js` byte size; cap +20 KB |
| R-6 | Now-line interval leaks across disconnects | Low | Med | `disconnectedCallback` clears interval; visibility-change `'hidden'` pause |
| R-7 | `customElements.define` collisions in dev | Low | Low | `@customElement` decorator handles it |
| R-8 | YAML with unknown `view` value crashes | Very Low | Low | Validate in `setConfig`; coerce to `'list'` (FR-1.4) |
| R-9 | Timed events crossing midnight render as all-day banners | (eliminated) | — | Use `splitTimedEventByDay` (preserves timed semantics) |
| R-10 | A11y regression: keyboard nav, focus states | Med | Med | ARIA labels on nav buttons; `:focus-visible` outline; `aria-disabled` for inactive buttons |
| R-11 | Masonry view distributes the card poorly without `getCardSize` | Med | Low | Add `getCardSize()` (FR-10.1). Section view is unaffected (default is full-width natural-height) |
| R-12 | Now-line spans all columns instead of today only | (eliminated) | — | Line is rendered inside the today day-column with `left:0; right:0` relative to that column (C-4 fix) |
| R-13 | Time axis misaligns with day columns | (eliminated in v4) | — | `.ccp-grid-body` is itself a 2-column grid (axis-width + 1fr). Day-columns area starts at the same x-coordinate as the headers' day cells (F-1 fix) |
| R-14 | `Today` button doesn't navigate to today when `start_date` is configured to a non-today value | (eliminated in v4) | — | `_todayOffset()` computes today's offset within the fetch window (F-8 fix) |
| R-15 | Initial render flashes N=1 then N=cap when `offsetWidth` is 0 (hidden tab, etc.) | Low | Low | `chooseVisibleDays` returns `cap` for `width === 0` only (real tiny widths return N=1) (v4-F1 fix) |
| R-16 | Cross-timezone display: events created in HA's TZ may appear at unexpected times in browser's TZ | Low | Low | Existing list-view behavior; documented in README. Not a regression |
| R-17 | All-day banner contrast against `event_color` text on dark themes when `event_background_opacity > 0` | (eliminated in v5) | — | Banner has its own `time_grid_allday_bg_opacity` config (default 0.2), independent of list-view's `event_background_opacity` (v4-F3 fix) |
| R-18 | Slot-height inconsistency between renderer / host / `getCardSize` if user overrides via card-mod | (eliminated in v5) | — | Slot height is a code constant `SLOT_HEIGHT_PX = 24`, not a CSS variable (v4-F9 fix) |
| R-19 | All-day banners that start before / end after visible window render incorrectly (column 1 = axis) | (eliminated in v5) | — | Banner placement clamps `dayIdx` and `numDays`; `◂`/`▸` overflow indicators added (v4-F6 fix) |
| R-20 | Nested scroll containers when `.ccp-grid` has `overflow-y: auto` and parent `.content-container` does too | (eliminated in v5) | — | `.ccp-grid` has no overflow setting; parent handles scroll (v4-F5 fix) |
| R-21 | In 7-day mode, single-step `<`/`>` buttons appear to do nothing because the window snaps to week boundaries | (eliminated in v5) | — | Single-step buttons hidden in N=7 mode; only `<<`/`>>` and `Today` shown (v4-F10 fix) |
| R-22 | `Today` button is a no-op when `start_date` is configured to a future date | Low | Low | User explicit configuration. Today's offset clamps to 0 (window start). Documented; not a regression. |
| R-23 | Hour-24 edge case (when `end_hour: 24`) produces invalid label or duplicate "12 PM" | (eliminated in v8) | — | Labels rendered at hours `[start_hour, end_hour-1]`, never at `end_hour` (v7-F4/F5 fix) |
| R-24 | `show_past_events: false` ignored in grid view, leading to inconsistent UX with list view | (eliminated in v8) | — | Renderer filters past events when `show_past_events === false`, mirroring `events.ts:168-172` (v7-F7 fix) |
| R-25 | `days_to_show` change in grid mode triggers wasted refetch | (eliminated in v8) | — | `hasConfigChanged` ignores `days_to_show` when `view: time-grid` (v7-F8 fix) |

## 10. Test plan

The codebase has no test runner. We add Vitest as a single dev dependency.

We **do not** snapshot Lit `TemplateResult`s. Lit SSR is not a current dependency, and bringing it in for one snapshot is heavyweight. List-view non-regression is guaranteed by:
1. The dispatch in `render()` only routes to `RenderGrid.renderTimeGrid` when `config.view === 'time-grid'`.
2. The list-view branch is unchanged byte-for-byte.
3. No edits to `src/rendering/render.ts` (apart from no edits at all).
4. The single edit to `src/utils/events.ts` is **additive only**: an optional 5th argument to `fetchEventData`. The list view doesn't pass it; behavior is unchanged.

What we don't test automatically:
- Lit rendering of the editor (would require `jsdom` + HA stubs).
- The actual `ResizeObserver` callback path.
- The HA `callApi` request flow.

### 10.1 Tests to write (TDD — first, before implementation)

```
test/utils/grid.test.ts
  ├ minutesFromMidnight (3 cases)
  ├ startOfDay (1 case)
  ├ daysBetween (5 cases: same day=0, 1-day forward=1, DST spring-forward=1 (23h day, requires Math.round),
                          DST fall-back=1 (25h day),
                          non-midnight inputs at 23:59 vs 00:01 next day = 1 (normalization))
  ├ startOfWeek (3 cases incl. already-aligned)
  ├ buildDayWindow (1 case, N=7)
  ├ snapToWindow
  │   - 7-day Mon-aligned
  │   - 7-day already aligned
  │   - 3-day rolling
  │   - 1-day no-op
  │   - DST spring-forward fixture
  │   - DST fall-back fixture
  ├ chooseVisibleDays (boundary table; 2 cap variants; width=0 fallback)
  ├ computeEventPlacement
  │   - in-bounds, minHeight clamp, clipped-top, clipped-bottom,
  │     outside-before, outside-after, defensive end<=start, defensive end==start
  ├ layoutOverlaps
  │   - non-overlapping, 2 overlapping, 3 in cluster, half-open,
  │     disconnected clusters, transitive overlap with lane reuse,
  │     unsorted input
  ├ splitTimedEventByDay
  │   - 2-midnight crossing, single-day, ends exactly at midnight (drops zero-duration)
  ├ getReferenceDate (4 cases)
  ├ isPastEvent (4 cases incl. all-day)
  ├ formatHourLabel (4 cases: 24h hour 0, 24h hour 13, 12h hour 0 → "12 AM", 12h hour 12 → "12 PM")
  └ getCardSize (4 cases: list view → 3, grid default → 17, grid with max_height='400px' → 8 (clamped),
                          grid with end_hour=24 + interval=60 → larger)
```

Total: roughly 30+ test cases. (Exact count locked at implementation time.)

### 10.2 Manual / acceptance verification

1. List view (no `view` set): visually identical to v3.2.0.
2. `view: time-grid` on a wide dashboard: 7 columns, week-aligned, today highlighted, now-line visible.
3. Resize the browser narrower: column count drops to 3, then 1; nav bar adapts (compact mode at N=1).
4. Click `<` `>` `<<` `>>` `Today`: navigation works, buttons disable at edges.
5. All-day events render as banners; timed events position correctly (test across DST boundary).
6. Test with: Google Calendar, CalDAV, HA's local Calendar integration.
7. Editor: toggle `view`, verify the Time grid panel appears/disappears; change each option and verify YAML output.
8. **Editor regression test:** save with non-default `time_grid_breakpoint_three_day_px = 600`; reload page; verify both breakpoints are still set correctly (this is the C-1 regression test).
9. **Today button test:** set `start_date: '-7'`; navigate forward; click Today; verify the visible window contains today (not today-7).
10. Section dashboard (HA "sections" view): card displays full-width with natural height.
11. Masonry dashboard: card height respects `getCardSize` (~17 rows for default 06–22 grid; clamped if `max_height` set).
12. **Hour-range validation:** YAML with `time_grid_start_hour: 30` (invalid) — verify card renders with default 06–22 and console warning.

### 10.3 Tooling additions

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
},
"devDependencies": {
  "vitest": "^2.1.0"
}
```
No new runtime dependencies. CI integration is a follow-up.

## 11. Open questions

| # | Question | Resolution |
|---|---|---|
| OQ-1 | (closed) How to snapshot Lit `TemplateResult`? | We don't. Non-regression rests on the dispatch guard and no-edit policy. |
| OQ-2 | (closed) Should `view: 'time-grid'` lock `days_to_show ≥ 7`? | No. `time_grid_navigation_days` (default 28) decouples grid navigation from `days_to_show`. |
| OQ-3 | (closed) Should we implement `getCardSize()`? | Yes, in this PR. (Not `getGridOptions` — section view is fine without it.) |
| OQ-4 | When `view: 'time-grid'` and `entities: []`, render a friendly empty-state? | Fall through to existing error state (acknowledgment of inherited behavior). |
| OQ-5 | Localized labels for nav buttons | Add 5 keys: `time_grid_today`, `time_grid_prev_day_aria`, `time_grid_next_day_aria`, `time_grid_prev_window_aria`, `time_grid_next_window_aria`. |
| OQ-6 | Surface `view: 'time-grid'` in `getStubConfig` and HACS preview | Out of scope — separate PR. |

## 12. Implementation phasing

This is one PR but split into reviewable commits:

1. **Test scaffolding** — add `vitest`, empty test file. `npm test` succeeds with zero tests.
2. **Pure helpers tests** — write all tests in §10.1 (red).
3. **Pure helpers implementation** — implement `src/utils/grid.ts`. Tests turn green.
4. **Config + types** — add fields to `Config` and `DEFAULT_CONFIG`; update `hasConfigChanged`. Lint clean.
5. **Render module** — implement `src/rendering/render-grid.ts`. Visual smoke-test by toggling `view` in YAML.
6. **Host wiring** — `ResizeObserver`, navigation, now-line interval (with **midnight refresh** per FR-11.5), `getCardSize`, visibility-change branches, and **the `effectiveDaysToShow` argument passed to `fetchEventData`** (per FR-5.4) in `calendar-card-pro.ts`.
7. **Fetch-window plumbing** — extend `fetchEventData` with `effectiveDaysToShow?` arg. Test list-view fetch unchanged.
8. **Styles** — append CSS section + new custom properties.
9. **Editor** — add view selector + conditional grid-options panel; helper-text hint when `time_grid_navigation_days < time_grid_max_days`.
10. **Translations** — add `en.json` keys.
11. **Docs** — update `docs/architecture.md`; add `### Time-grid view` section to README.

## 13. Definition of done

- All FRs in §4 are implemented and either covered by Vitest specs (§10.1) or the manual checklist (§10.2).
- `npm run lint` passes with no warnings or errors.
- `npm run build` succeeds. Bundle size delta ≤ +20 KB.
- `npm test` passes (new).
- List-view paths in `src/rendering/render.ts` are unchanged (zero edits).
- The edit to `src/utils/events.ts` is additive only (one optional argument; existing callers unaffected).
- Editor regression test (§10.2 step 8) passes — partial config update preserves all defaults.
- `docs/architecture.md` reflects the new files.
- README has a `### Time-grid view` section.
- PR description references issues #300, #14, #239, #282, #325 with a clear "addresses / partially addresses" mapping.
