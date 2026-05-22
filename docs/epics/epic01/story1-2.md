# Story 1-2 — Navigation Handlers `<` `>` `<<` `>>` `Today`

**Epic**: [epic01 — Responsive Columns + Navigation](README.md)
**Status**: Not started
**Estimate**: M (~half day)
**Depends on**: [story1-1](story1-1.md) (visibleDays is now reactive)

---

## User story

> **As a** user viewing the time-grid,
> **I want** to navigate forward and backward through dates using on-card buttons,
> **So that** I can plan ahead or look at past schedules without changing config.

## Why this is needed

epic00 emitted placeholder no-op handlers. This story makes them real. The button visibility (which buttons appear at N=1 vs N=3 vs N=7) was already handled in story1-1; this story wires the click handlers.

## Acceptance criteria

- [ ] `src/calendar-card-pro.ts` adds private methods:
  ```ts
  private _maxOffset(): number {
    return Math.max(0, this.config.time_grid_navigation_days - this.visibleDays);
  }

  private _shiftDays(delta: number): void {
    const next = this.viewOffsetDays + delta;
    this.viewOffsetDays = Math.max(0, Math.min(this._maxOffset(), next));
  }
  ```
- [ ] *(Today button uses `_todayOffset()` which arrives in story1-3, but the wiring here uses `0` as a placeholder for this story; story1-3 swaps to `_todayOffset()`)*
- [ ] `render()` passes real handlers in the `ctx`:
  ```ts
  onShiftDay: (d) => this._shiftDays(d),
  onShiftWindow: (d) => this._shiftDays(d * this.visibleDays),
  onResetToToday: () => { this.viewOffsetDays = 0; },  // story1-3 changes to _todayOffset()
  canShiftBack: this.viewOffsetDays > 0,
  canShiftForward: this.viewOffsetDays < this._maxOffset(),
  ```
- [ ] Renderer (`render-grid.ts`):
  - Buttons fire `ctx.onShiftDay(-1)` / `ctx.onShiftDay(1)` / `ctx.onShiftWindow(-1)` / `ctx.onShiftWindow(1)` / `ctx.onResetToToday()`
  - Each button has `aria-label` (the 5 navigation strings come in epic03 from translations; placeholder English strings here)
  - Each button calls `event.stopPropagation()` so it does NOT trigger the card-level `tap_action`
  - Buttons use `aria-disabled="true"` (and visual opacity 0.4 from CSS) when at edge:
    - Back buttons (`<`, `<<`): `aria-disabled` when `!ctx.canShiftBack`
    - Forward buttons (`>`, `>>`): `aria-disabled` when `!ctx.canShiftForward`
    - `Today` button: never disabled (always functional)
  - Date-range label: shows the current visible window (e.g., `"May 11 – May 17, 2026"`); for now use simple format, localization in epic03
- [ ] Test: `Spec G-4.4` — `_shiftDays` clamping
  - In `test/utils/host.test.ts` or test the underlying logic by extracting `_shiftDays` math to `utils/grid.ts:clampOffset(current, delta, max)` (preferred)
  - Alternative: skip Lit-host tests; rely on manual smoke test
- [ ] Buttons are keyboard-accessible: `Enter` and `Space` activate them (default browser behavior on `<button>`); `:focus-visible` outline styling is already in CSS from epic00 story0-6

## Out of scope

- `_todayOffset()` math (story1-3 — for this story, `Today` resets to 0)
- Localized button labels (epic03)
- Auto-scroll-to-today on render (deferred follow-up)

## Technical notes

- **`stopPropagation` on buttons**: the card's `pointerdown`/`pointerup` handlers (from `_handlePointerDown`) propagate up. Without `stopPropagation`, clicking a nav button would also fire `tap_action`. Add to each button's `@click` handler.
- **`_shiftDays` and `_maxOffset` testability**: these depend on `this.config` and `this.visibleDays`, but the math itself is pure. Consider extracting to `utils/grid.ts:clampOffset(current, delta, max)` to enable unit testing without Lit host.
- **`canShiftBack/canShiftForward`**: computed in render, consumed by template. Lit's `@property` on `viewOffsetDays` triggers re-render which re-evaluates these flags.
- **Date range label format**: for v1, just `MMM D – MMM D, YYYY` using existing `formatTime`-style localized formatting. Spans across year boundary (Dec 30 – Jan 5) handled by including year on each side: `Dec 30, 2026 – Jan 5, 2027`. Cosmetic; refine in epic03 with translations.

## Files touched

```
src/calendar-card-pro.ts            +3 methods (~25 lines)
src/rendering/render-grid.ts        nav header markup (~30 lines)
src/utils/grid.ts                   optionally +clampOffset (~5 lines)
test/utils/grid.test.ts             optionally +clampOffset tests (~15 lines)
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean
- `npm test` passes (including any new clampOffset tests)
- Manual smoke test:
  - Click `<<` shifts visible window backward by N days; `<` by 1 day
  - At offset 0, back buttons show `aria-disabled` (visually faded)
  - Click `Today` resets to offset 0
  - Click `<<` `>>` from offset 7 with N=7 navigation_days=28 → offset 14 → 21 → clamped at 21
  - Tapping anywhere else on the card still triggers card-level `tap_action`
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` prefix)

## Mapping

- **Design doc**: §6.5 (`_shiftDays`, `_maxOffset`), FR-4.1 through FR-4.6
- **Acceptance specs**: G-4.4
- **AGENTS.md**: Rule 1 (verify Lit `aria-disabled` semantics — it's an attribute, not a prop)
