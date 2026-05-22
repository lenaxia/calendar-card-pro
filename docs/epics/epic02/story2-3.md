# Story 2-3 — Midnight Refresh + Visibility-Change Pause

**Epic**: [epic02 — All-Day Banners + Now-Line](README.md)
**Status**: Not started
**Estimate**: S (~2 hours)
**Depends on**: [story2-2](story2-2.md) (interval already exists)

---

## User story

> **As a** user who leaves calendar-card-pro open overnight (e.g., on a kitchen tablet),
> **I want** the "today" highlight and now-line to move to the new day at midnight without me touching anything,
> **So that** the morning view shows the correct day, not yesterday's.
>
> **As the same user** who switches browser tabs frequently,
> **I want** the card not to waste CPU/battery on background ticks,
> **So that** I'm not draining my laptop battery for an off-screen card.

## Why this is needed

Story2-2 set up the 60-second interval but `_updateNowLinePosition` only updates the line *position*. It doesn't detect that the local date changed. Without intervention, after midnight the renderer's cached `ctx.now` (captured at the last render) is stale: yesterday's column still has the `today` class and the now-line still sits there. This story adds the midnight check.

It also adds the visibility-change pause to avoid background ticking when the card isn't visible.

## Acceptance criteria

- [ ] `src/calendar-card-pro.ts` `_updateNowLinePosition` adds the midnight check **at the very top** (before the `lineEl` null-guard):
  ```ts
  private _updateNowLinePosition(): void {
    // (1) Midnight detection — runs FIRST. Must fire even when today is not currently
    //     in the visible window, otherwise stale 'today' class persists until the next
    //     user-triggered re-render. See FR-11.5.
    const todayStart = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();
    if (todayStart !== this._lastRenderDay) {
      this._lastRenderDay = todayStart;
      this.requestUpdate();   // forces re-render with fresh ctx.now
      return;                  // re-render will re-invoke us via the next tick if needed
    }

    // (2) Position update (existing logic from story2-2) ...
  }
  ```
- [ ] `updated(changedProps)` sets `_lastRenderDay` after each render commits (so subsequent ticks use the freshest day):
  ```ts
  // After existing updated() logic:
  if (this.config.view === 'time-grid') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    this._lastRenderDay = d.getTime();
  }
  ```
- [ ] `_handleVisibilityChange` adds a `'hidden'` branch:
  ```ts
  private _handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // existing data-refresh logic (do not modify)
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
      // NEW: pause now-line interval to avoid background ticks
      this._stopNowLine();
    }
  };
  ```
- [ ] Test: spec G-midnightRefresh
  ```
  GIVEN view='time-grid', card has rendered with ctx.now = 2026-05-13 23:59 local
   AND  _lastRenderDay = startOfDay(2026-05-13).getTime()
  WHEN clock advances to 2026-05-14 00:00
   AND  the now-line interval ticks (or _updateNowLinePosition is invoked manually)
  THEN _lastRenderDay !== startOfDay(2026-05-14).getTime() before the check
   AND requestUpdate() is called
   AND on the next render, ctx.now is fresh (today = 2026-05-14)
   AND 'today' class moves to the new day-column
  ```
  Implementation: this is hard to fully unit-test without mocking `Date.now`, `setInterval`, and Lit's `requestUpdate`. Two practical approaches:
  - (preferred) Unit-test the date-comparison logic in isolation: `utils/grid.ts:hasDayChanged(lastRenderDay: number, now: Date): boolean`
  - Manual integration test: use browser DevTools to advance system clock or wait until midnight on a real card

## Out of scope

- Stop/start interval based on whether today is currently visible in the window (deferred — wasteful but harmless, ~1 wasted call/min when out of window)
- Auto-scroll to now-line on visibility-resume (deferred)

## Technical notes

- **Why midnight check is BEFORE the lineEl null-guard**: the now-line element only exists in today's day-column when today is in the visible window. If user has navigated to next week (today not visible), `lineEl` is null. Without the early check, midnight detection never fires for that user → stale state. This was design v9 / v10 review finding F-1.
- **`requestUpdate` is idempotent within a Lit microtask**: calling it multiple times in the same frame is safe; Lit batches.
- **`_lastRenderDay` set in `updated()`**: ensures the field stays in sync with the renderer's `ctx.now`. Without this, after the first re-render `_lastRenderDay` is still pointing to the OLD day until the next tick — fine in practice but the explicit set is defense-in-depth.
- **Visibility-change pause**: existing `_handleVisibilityChange` only handles `'visible'` (data refresh). We're adding the `'hidden'` branch to stop the now-line interval. Be careful not to break the existing data-refresh logic.
- **No `setInterval` polyfill needed**: `window.setInterval` is universally available in HA's supported browsers.

## Files touched

```
src/calendar-card-pro.ts          +midnight check in _updateNowLinePosition (~10 lines)
                                  +_lastRenderDay set in updated() (~5 lines)
                                  +'hidden' branch in _handleVisibilityChange (~5 lines)
src/utils/grid.ts                 +hasDayChanged (~5 lines)
test/utils/grid.test.ts           +hasDayChanged tests + G-midnightRefresh logic test (~10 lines)
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean
- `npm test` passes (hasDayChanged or extracted day-comparison logic)
- `npm run build` succeeds
- Manual smoke test:
  - Open card, note current "today" column highlight
  - Wait until midnight (or change system clock to 23:59:30 → 00:00:30) → within 60s, today highlight moves to new day
  - Switch to a different browser tab → check DevTools that no setInterval is firing
  - Switch back → interval resumes, line repositioned correctly
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` or `fix:` prefix; this is technically fixing a stale-render bug that would otherwise ship)

## Mapping

- **Design doc**: §6.5 (midnight check), FR-11.5
- **Acceptance specs**: G-midnightRefresh
- **AGENTS.md**: Rule 1 (verify `document.visibilityState` API by reading MDN), Rule 5 (no list-view changes — visibility-change handler stays compatible with existing list refresh)
