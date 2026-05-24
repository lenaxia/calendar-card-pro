# Story 1-3 — Window Alignment (Week-Aligned 7-Day, Rolling 1/3-Day)

**Epic**: [epic01 — Responsive Columns + Navigation](README.md)
**Status**: Not started
**Estimate**: M (~half day)
**Depends on**: [story1-2](story1-2.md), [epic00/story0-2](../epic00/story0-2.md) (`snapToWindow` + `getReferenceDate` already implemented)

---

## User story

> **As a** user looking at the 7-day grid view,
> **I want** the visible week to start on Monday (or Sunday per `first_day_of_week`),
> **So that** I see calendar weeks the way I think about them, not a rolling 7-day window from today.
>
> **As the same user** at 1- or 3-day mode,
> **I want** the visible window to start at today (or wherever I've navigated to),
> **So that** narrow widths show the most relevant info.
>
> **As the same user** clicking `Today`,
> **I want** the window to actually contain today,
> **So that** the button does what its label says — even when `start_date` is configured to a non-today value.

## Why this is needed

Currently `renderTimeGrid` (epic00) builds the day window from `now + offsetDays` — works for N=1 and N=3 but produces a "rolling" 7-day view that doesn't snap to the calendar week. And `Today` button (story1-2) sets offset to 0, which is wrong when `start_date: '-7'` (would show 7 days ago, not today).

This story uses `snapToWindow` and adds `_todayOffset()` to fix both.

## Acceptance criteria

- [ ] `src/calendar-card-pro.ts` adds:
  ```ts
  private _todayOffset(): number {
    const reference = Grid.getReferenceDate(this.config);  // start of fetch window, midnight
    const today = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    })();
    const diffDays = Grid.daysBetween(reference, today);
    return Math.max(0, Math.min(this._maxOffset(), diffDays));
  }
  ```
- [ ] `render()` updates `onResetToToday` to use `_todayOffset()`:
  ```ts
  onResetToToday: () => { this.viewOffsetDays = this._todayOffset(); }
  ```
- [ ] **No changes to `render-grid.ts` in this story** — epic00 story0-4 already calls `Grid.snapToWindow(reference, ctx.offsetDays, ctx.visibleDays, firstDayOfWeek)` and uses its `days` array for column construction. The week-aligned vs rolling logic lives inside `snapToWindow` itself (epic00 story0-2). This story's only renderer-side dependency is that `snapToWindow` MUST snap to week boundaries when `dayCount === 7` — verified in story0-2's spec G-5.1.
- [ ] When N = 7: window snaps to the start of the user's week (Mon or Sun per `first_day_of_week`); offset shifts move the window by 7 days at a time even when single-step buttons fire `_shiftDays(1)` because `snapToWindow` re-snaps to the week boundary (single-step `<` `>` in N=7 mode are already hidden per story1-1, so this is mostly a defensive correctness check)
- [ ] When N ∈ {1, 3}: window starts at `reference + offsetDays` (rolling)
- [ ] `Today` button works correctly with non-today `start_date`:
  - `start_date: '-7'` (7 days ago) → reference = today-7, `_todayOffset()` returns 7
  - `start_date` undefined → reference = today, `_todayOffset()` returns 0
  - `start_date: '+5'` (future) → reference = today+5, `_todayOffset()` returns `Math.max(0, -5) = 0` (clamped; documented as edge case in design doc R-22)
- [ ] Test: spec G-Today
  ```
  GIVEN config.start_date = '-7', time_grid_navigation_days = 28, visibleDays = 7, viewOffsetDays = 14
  WHEN onResetToToday is called
  THEN viewOffsetDays === 7
  AND the window (after snapToWindow) contains today
  ```
  *Implementation: extract `_todayOffset` math into `utils/grid.ts:computeTodayOffset(referenceDate, today, visibleDays, navigationDays)` for unit testability.*

## Out of scope

- Auto-scroll to today's column on initial render (deferred)
- Visual highlight of "today is in the past of the visible window" or similar (out of scope; there's no UX requirement)

## Technical notes

- **`snapToWindow` was already implemented in epic00 story0-2** — this story consumes it, doesn't re-implement
- **`daysBetween` was hardened in epic00 story0-2** to handle DST via `Math.round` and to normalize non-midnight inputs via `startOfDay`
- **R-22 future start_date case**: `_todayOffset()` clamps to 0 when today < reference. UX result: clicking Today does nothing visible. Acceptable per stakeholder discussion (user explicitly configured a future start).
- **Why `getFirstDayOfWeek(config, hass)`**: existing utility (used by list view) reads `config.first_day_of_week` ('system' | 0 | 1) and resolves 'system' to HA locale. Reusing it keeps grid view consistent with list view's week semantics.
- **`todayIdx` use site**: passed to `render-grid.ts` per-column markup so the `today` class can be applied (used by epic02 for the now-line).

## Files touched

```
src/calendar-card-pro.ts         +1 method (_todayOffset, ~10 lines); update onResetToToday handler
src/utils/grid.ts                +computeTodayOffset extraction (~5 lines)
test/utils/grid.test.ts          +G-Today test cases (~20 lines)
```

(no changes to `src/rendering/render-grid.ts` — story0-4 already wires `snapToWindow`)

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean
- `npm test` passes (G-Today + spec G-5.1, G-5.1b, G-5.2 from epic00 still pass)
- Manual smoke test:
  - 7-day mode shows Mon-Sun (or Sun-Sat per locale); navigating with `<<` `>>` advances by full week
  - 3-day mode shows today, today+1, today+2; navigating with `<` shifts by 1 day
  - 1-day mode shows just today; `<` `>` shift by 1 day
  - YAML `start_date: '-7'` + Today button → window contains today (verify visually)
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` prefix)

## Mapping

- **Design doc**: §6.5 (`_todayOffset`), FR-5.1, FR-5.2, FR-5.3
- **Acceptance specs**: G-Today, G-5.1, G-5.1b, G-5.2
- **AGENTS.md**: Rule 1 (verify `getFirstDayOfWeek` returns 0 or 1 by reading `format.ts`)
