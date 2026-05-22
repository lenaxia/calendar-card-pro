# Story 0-2 — Pure Helpers in `utils/grid.ts` (TDD)

**Epic**: [epic00 — Time-Grid Base View](README.md)
**Status**: Not started
**Estimate**: M (medium — ~30 test cases + ~12 functions)
**Depends on**: [story0-1](story0-1.md) (Vitest scaffold)

---

## User story

> **As a** developer implementing the time-grid view,
> **I want** all date/layout/overlap math extracted into pure, unit-tested helpers in `src/utils/grid.ts`,
> **So that** rendering logic can be small and obvious, edge cases (DST, midnight crossings, overlap clusters) are provably correct, and the helpers can be re-used by epic01/02 without coupling to Lit or HA.

## Why this is needed

The design doc §6.3 specifies a single pure-helper module covering all the non-trivial math. These helpers can be tested in isolation (no Lit, no DOM, no HA mocks) — the design rejected snapshot-testing Lit templates as overengineered. The substantive bugs caught during the 12-pass review (DST `floor` vs `round`, view-toggle stale data, banner clamping) all come from this layer; getting them right is what makes the epic safe to ship.

## Acceptance criteria

- [ ] `src/utils/grid.ts` exports:
  - `SLOT_HEIGHT_PX = 24` (constant)
  - `minutesFromMidnight(d: Date): number`
  - `startOfDay(d: Date): Date` (returns local 00:00:00.000)
  - `daysBetween(a: Date, b: Date): number` — internally normalizes inputs via `startOfDay` then uses `Math.round`. Wrong with `Math.floor`: spring-forward gives `floor(23h/24h) = 0` instead of 1.
  - `startOfWeek(d: Date, firstDayOfWeek: 0 | 1): Date` — returns local midnight
  - `buildDayWindow(from: Date, dayCount: number): Date[]` — each entry at local midnight
  - `chooseVisibleDays(widthPx, bpThreeDayPx, bpSevenDayPx, cap): 1 | 3 | 7` — `widthPx === 0` returns `cap` (no-measurement fallback), real widths use breakpoints
  - `computeEventPlacement(startMin, endMin, gridStartMin, gridEndMin, slotHeightPx, intervalMin, minHeightPx): EventPlacement`
  - `layoutOverlaps<T>(events: T[]): Array<T & { laneIndex, laneCount }>` — cluster-based packing, sorts internally
  - `splitTimedEventByDay(event, windowStart, windowEnd): CalendarEventData[]` — preserves timed semantics; drops zero-duration segments (events ending exactly at midnight). **Each returned segment preserves the original event's metadata via spread**: `{...originalEvent, start: { dateTime: segStartIso }, end: { dateTime: segEndIso }}` — only `start` and `end` are replaced; `summary`, `description`, `location`, `_entityId`, `_matchedConfig`, `_entityLabel`, etc. are inherited unchanged.
  - `getReferenceDate(config: Pick<Config, 'start_date' | 'days_to_show'>): Date` — returns local midnight; replicates `events.ts:getStartDateReference` via public `getTimeWindow`
  - `isPastEvent(event: CalendarEventData, now: Date): boolean` — replicates `render.ts:isPastEvent` semantics
  - `formatHourLabel(hour: number, use24h: boolean): string` — `5` → `"5"` or `"5 AM"`, no minutes (axis labels are hour-only)

- [ ] All functions have JSDoc explicitly stating midnight-normalization where relevant (per AGENTS.md "Validate assumptions; document contracts")
- [ ] `test/utils/grid.test.ts` covers (minimum):
  - `minutesFromMidnight`: 3 cases
  - `startOfDay`: 1 case
  - `daysBetween`: 5 cases (same day=0, +1=1, DST spring-forward=1, DST fall-back=1, non-midnight inputs at 23:59 vs 00:01 next day = 1)
  - `startOfWeek`: 3 cases (Sun-aligned, Mon-aligned, already-aligned)
  - `buildDayWindow`: 1 case (N=7)
  - `chooseVisibleDays`: boundary table (5 widths × 2 cap variants) + width=0 fallback case
  - `computeEventPlacement`: 8 cases (in-bounds, minHeight clamp, clipped-top, clipped-bottom, outside-before, outside-after, end<=start defensive, end==start defensive)
  - `layoutOverlaps`: 5 cases (non-overlapping, 2 overlapping, 3-cluster, half-open intervals, disconnected clusters, transitive overlap with lane reuse, unsorted input)
  - `splitTimedEventByDay`: 3 cases (2-midnight crossing, single-day, ends exactly at midnight)
  - `getReferenceDate`: 4 cases
  - `isPastEvent`: 4 cases (timed past, timed future, all-day past, all-day future)
  - `formatHourLabel`: 4 cases (24h hour 0, 24h hour 13, 12h hour 0 → "12 AM", 12h hour 12 → "12 PM")

*Note: additional pure helpers added in later stories (e.g., `computeNowLineTop` in story2-2, `computeBannerPlacement` in story2-1, `hasDayChanged` in story2-3, `computeCardSize` in story0-7) are NOT implemented here — each is added by its consumer story. This story sets up the foundational helpers for epic00.*
- [ ] All tests written **before** the implementation (TDD — commit history should show red-then-green ideally; if squashed, commit message references TDD discipline)
- [ ] All tests pass (`npm test`)
- [ ] No `any` types (lint-enforced)
- [ ] No imports from Lit, DOM, HA, or `events.ts` (helpers must be pure — verify with grep)
- [ ] `formatHourLabel` does NOT reuse `FormatUtils.formatTime` (which always emits `:00`, wasting axis width)

## Out of scope

- Calling these helpers from a renderer (story0-4)
- CSS for hour labels / event blocks (story0-6)
- Banner placement helpers (some of these will be added in epic02)

## Technical notes

- **All pure helpers added in this story, even ones epic00 doesn't actively use** (e.g., `chooseVisibleDays` is only consumed by epic01 story1-1, but defined here). Rationale: keeps `utils/grid.ts` cohesive; lets the test suite cover the full helper surface in one place; supports parallel work where another developer can wire up epic01 without touching epic00 code.
- **DST math**: design doc revision history records this bug (v10-F2). Use `Math.round`, not `Math.floor`.
- **Cluster algorithm**: sort by `startMin`, walk; while `next.startMin < cluster_max_endMin`, extend cluster; max simultaneous = `laneCount`; greedy lane assignment; transitively-overlapping events share one cluster (G-2.9d in design doc).
- **Half-open intervals**: events touching at one instant (A ends at 10:00, B starts at 10:00) do NOT overlap (strict `<`).
- **`splitTimedEventByDay` differs from `events.ts:splitMultiDayEvent`** — the latter converts middle days to all-day, which is wrong for grid view.
- **`getReferenceDate`** calls public `EventUtils.getTimeWindow` (replicating private `getStartDateReference` logic without touching `events.ts`).

## Files touched

```
src/utils/grid.ts            new (~250 lines)
test/utils/grid.test.ts      replaces placeholder with ~30 cases
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean
- `npm test` runs and passes (target: subsecond runtime for the suite)
- `npm run build` succeeds; bundle delta from this story alone ≤ ~5 KB
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` or `test:` prefix)

## Mapping

- **Design doc**: §6.3 (helper signatures), §8 (specs G-2.5 through G-isPast and G-hourLabel*), §10.1 (test list), §12 phases 2-3
- **AGENTS.md**: Rule 1 (validate assumptions), Rule 8 (TDD)
- **Acceptance specs in design doc**: G-2.5, G-2.5b, G-2.6a/b/c/d/e/f, G-2.8a/b, G-2.9/b/c/d/e, G-3.1/3.1b, G-5.1/5.1b/5.2, G-isPast, G-hourLabel, G-hourLabelRange
