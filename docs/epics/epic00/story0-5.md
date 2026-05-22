# Story 0-5 — Render Dispatch + Minimal Host Wiring

**Epic**: [epic00 — Time-Grid Base View](README.md)
**Status**: Not started
**Estimate**: M (medium — host changes ~1 day)
**Depends on**: [story0-3](story0-3.md), [story0-4](story0-4.md)

---

## User story

> **As a** YAML user with `view: 'time-grid'` set,
> **I want** the card to actually render the grid (not just accept the config),
> **So that** the feature works end-to-end at default settings.

## Why this is needed

Story0-3 added the schema. Story0-4 wrote the renderer. This story connects them: the host's `render()` method dispatches to `renderTimeGrid` when `view === 'time-grid'`, while leaving every other path byte-identical.

This is the smallest possible host change that makes the feature observable. Larger host work (`ResizeObserver`, navigation, now-line, midnight refresh, fetch-window override) is deferred to epic01/02.

## Acceptance criteria

- [ ] `src/calendar-card-pro.ts` adds two reactive properties:
  ```ts
  @property({ attribute: false }) viewOffsetDays = 0;
  @property({ attribute: false }) visibleDays: 1 | 3 | 7 = 7;  // hard-coded 7 in this epic
  ```

  *Note: `viewOffsetDays` exists as a reactive field from this story onward, but is only mutated by user input (nav buttons) starting in epic01. In epic00, the only mutation point is `onResetToToday` which sets it back to 0 — already its default — so it's effectively no-op. Adding the field early lets the renderer (story0-4) consume `ctx.offsetDays` from day one.*
- [ ] `render()` adds the grid-view branch in the existing dispatch (after error checks, before list-empty check):
  ```
  isInitialLoad → 'loading'
  !safeHass || !entities → 'error'
  config.view === 'time-grid' → RenderGrid.renderTimeGrid(...)   [NEW]
  events.length === 0 → existing list-empty branch
  default → existing list normal branch
  ```
- [ ] `ctx` passed to `renderTimeGrid` uses placeholder no-op handlers (epic01 wires real ones):
  ```ts
  {
    visibleDays: this.visibleDays,
    offsetDays: this.viewOffsetDays,
    now: new Date(),
    onShiftDay: () => {},        // placeholder
    onShiftWindow: () => {},      // placeholder
    onResetToToday: () => { this.viewOffsetDays = 0; },
    canShiftBack: false,          // hard-coded false in this epic
    canShiftForward: false,       // hard-coded false
  }
  ```
- [ ] `src/rendering/render.ts` is **not modified** (FR-1.2 invariant — verify with `git diff upstream/dev -- src/rendering/render.ts` produces empty output)
- [ ] `src/utils/events.ts` is **not modified** (the `effectiveDaysToShow` arg arrives in epic01)
- [ ] List view (no `view` set, or `view: 'list'`) is byte-identical to `upstream/dev` HEAD: same `renderGroupedEvents` callsite, same arguments
- [ ] `view: 'time-grid'` renders the grid using whatever `this.events` contains (from the existing `days_to_show` fetch). Since `days_to_show` defaults to 3, only ~3 days of events are visible at first; users can bump `days_to_show` manually for now (epic01 introduces the proper `time_grid_navigation_days` decoupling)

## Out of scope

- `ResizeObserver` for responsive columns (epic01)
- Real navigation handlers `<` `>` `<<` `>>` (epic01)
- Today button that snaps to today's offset within the fetch window (epic01)
- Now-line interval and midnight refresh (epic02)
- `getCardSize` (story0-7 within this epic, but a separate commit)
- `effectiveDaysToShow` plumbing through `fetchEventData` (epic01)
- All-day banner rendering (epic02)

## Technical notes

- **`viewOffsetDays` and `visibleDays` as `@property({ attribute: false })`**: Lit auto-detects identity changes (`!==`) and triggers re-render. No explicit `requestUpdate()` needed.
- **No `setConfig` change in this story**: the schema fields and validation already arrived in story0-3; here we only consume `this.config.view`.
- **No `connectedCallback` changes**: ResizeObserver wiring waits for epic01.
- **No `disconnectedCallback` changes**: nothing to clean up yet.
- **`tap_action: 'expand'` is a known no-op in grid view** — list-view's `isExpanded` toggle has no effect on grid rendering. Documented in design doc §7; not an in-scope change for this story.

## Files touched

```
src/calendar-card-pro.ts     +2 reactive props, +1 render branch (~10 lines net)
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean
- `npm run build` succeeds
- Manual smoke test 1: `view: list` (or no `view` field) renders the existing list view with no visible difference vs `upstream/dev`
- Manual smoke test 2: `view: time-grid` renders the grid; events show up; no console errors
- `git diff upstream/dev -- src/rendering/render.ts src/utils/events.ts` produces empty output
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` prefix)

## Mapping

- **Design doc**: §6.5 (host wiring — render dispatch portion only), FR-1.2, FR-1.3
- **AGENTS.md**: Rule 5 (list view untouchable), Rule 1 (validate the byte-identical claim with `git diff`)
