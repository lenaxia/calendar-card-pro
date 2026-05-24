# Worklog 0012 — Story 1-3: Window alignment + _todayOffset

**Date**: 2026-05-22
**Story**: [epic01/story1-3](../epics/epic01/story1-3.md)
**Status**: Implementation complete; ready to commit

---

## What was done

Closes the loop on navigation correctness:

1. The 7-day grid view now snaps to the configured first day of the week
   (Mon by default, Sun for `first_day_of_week: 'sunday'`) instead of
   producing a rolling 7-day window from `now + offsetDays`. This was
   already true mechanically — story 0-4's renderer already calls
   `Grid.snapToWindow(...)` which handles week alignment internally
   (story 0-2 spec G-5.1) — but story 1-3 verifies the contract holds
   end-to-end.
2. The `Today` button now actually centers on today even when
   `start_date: '-7'` (or `'today-7'` etc.) moves the fetch reference
   away from today. New host method `_todayOffset()` computes the
   offset that brings today into the visible window, clamped to the
   valid `[0, navigation_days - visibleDays]` range.

### Files modified

| File | Change |
|---|---|
| `src/utils/grid.ts` | +20 lines: `computeTodayOffset(reference, today, visibleDays, navigationDays)` exported helper. Pure math; testable without Lit. Reuses `daysBetween`. |
| `src/calendar-card-pro.ts` | +12 lines (`_todayOffset()` method); -1 line / +1 line (`onResetToToday` swapped from `viewOffsetDays = 0` to `_todayOffset()`). |
| `test/utils/grid.test.ts` | +33 lines: import added; `describe('computeTodayOffset')` with 5 cases including spec G-Today. |

### Files NOT modified

- `src/rendering/render-grid.ts` — story 0-4 already wires `snapToWindow` for week alignment; nothing to change.
- `src/rendering/render.ts`, `src/utils/events.ts` — Rule 5 invariants intact.

---

## Verified vs. assumed

| Claim | Verified by | Status |
|---|---|---|
| `Grid.snapToWindow` already snaps to week boundaries when `dayCount === 7` | grid.ts:136-158 (story 0-2 implementation) + tests at test/utils/grid.test.ts spec G-5.1 | ✅ Verified |
| `Grid.getReferenceDate(config)` returns local-midnight Date | grid.ts:367-379 (story 0-2) | ✅ Verified |
| `Grid.daysBetween(a, b)` uses Math.round (DST-safe) | grid.ts:84-89 | ✅ Verified |
| Spec G-Today math: ref=today-7, today=today → diff=7; clamp into [0,21] → 7 | manually traced + test asserts 7 | ✅ Verified |
| Future start_date case: ref=today+5, today=today → diff=-5; max(0, min(21, -5)) → 0 | trace + test asserts 0 | ✅ Verified (R-22 from design doc) |
| `_todayOffset` clamping uses `_maxOffset()` indirectly via the `navigationDays - visibleDays` formula | re-derived in computeTodayOffset (no DRY violation; one is host config + visibleDays getter, the other is the pure math) | ✅ Verified |

---

## Spec G-Today walk-through

Story line 56-62:
```
GIVEN config.start_date = '-7', time_grid_navigation_days = 28, visibleDays = 7, viewOffsetDays = 14
WHEN onResetToToday is called
THEN viewOffsetDays === 7
  AND the window (after snapToWindow) contains today
```

- `getReferenceDate({start_date: '-7', days_to_show: 3})` returns today-7 at midnight.
- `_todayOffset()`:
  - reference = today - 7 days, today = today
  - diffDays = daysBetween(today-7, today) = 7
  - max = max(0, 28 - 7) = 21
  - return max(0, min(21, 7)) = 7
- After `viewOffsetDays = 7`, the window starts at `reference + 7 = today` (for N=3) or snaps to the start of today's week (for N=7). Either way, today is in the window. ✓

The first 4 test cases pin this; case 5 verifies 1-day mode where max changes (1→13 instead of 1→7).

---

## Verification commands and results

```
$ npm run lint   → clean
$ npm test
  Tests  73 passed (68 + 5 new computeTodayOffset)
  Duration ~50ms
$ npm run build  → succeeded
$ ls -la dist/calendar-card-pro.js  → 304,861 bytes (+251 from story 1-2's 304,610)
$ git diff --stat HEAD -- src/rendering/render.ts src/utils/events.ts  → empty (Rule 5)
$ git diff --stat HEAD -- src/rendering/render-grid.ts  → empty (correct: no renderer change)
```

---

## Decisions and rationale

1. **`computeTodayOffset` extracted to grid.ts** rather than inlined in
   `_todayOffset()`: testable without LitElement; matches the pattern
   established by `clampOffset`, `chooseVisibleDays`, etc.

2. **`_todayOffset()` reads `new Date()` fresh each call**: the call is
   click-driven (Today button), not render-driven. No closure-staleness
   risk. The pure helper takes `today` as an arg so tests can pin it.

3. **No render-grid.ts change**: story line 49 explicitly says "No
   changes to render-grid.ts in this story". The week-alignment math
   lives entirely in `snapToWindow` (already in story 0-2), and the
   renderer already consumes it (story 0-4 line 83). Story 1-3 only
   updates the click handler, which is host-side.

---

## Open questions / follow-ups

- **Manual smoke test deferred to PR review**: 4 sub-tests per story
  line 93-97 (week alignment for 7-day, rolling for 3/1-day, Today with
  `start_date: '-7'`).
- Auto-scroll to today's column on initial render is explicitly out of
  scope (story line 67).

---

## Next: Story 1-4

Final story of epic01. Plumbs `time_grid_navigation_days` through
`fetchEventData` via the optional `effectiveDaysToShow?: number` arg
that AGENTS.md Rule 5 explicitly allows. Also makes `hasConfigChanged`
view-aware so toggling list/grid triggers a refetch.

After 1-4, the time-grid view will be functionally complete; epic02 and
epic03 add polish (banners, now-line, midnight refresh, editor, i18n).
