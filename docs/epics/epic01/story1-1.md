# Story 1-1 — Responsive `ResizeObserver` + Width-Based Column Count

**Epic**: [epic01 — Responsive Columns + Navigation](README.md)
**Status**: Not started
**Estimate**: M (~half day)
**Depends on**: [epic00/story0-2](../epic00/story0-2.md) (`chooseVisibleDays` helper exists), [epic00/story0-5](../epic00/story0-5.md) (host has `visibleDays` reactive prop)

---

## User story

> **As a** user with calendar-card-pro placed in a dashboard column whose width changes (mobile vs desktop, sidebar vs panel, multi-column dashboards),
> **I want** the time-grid view to auto-adjust the number of visible day columns based on the card's actual rendered width,
> **So that** I see 7 days on a wide desktop, 3 days on a tablet, and 1 day on a phone — without manual config-toggling.

## Why this is needed

epic00 hard-coded `visibleDays = 7`. This story makes it responsive via `ResizeObserver` on the host element. Three new config fields control the breakpoints and cap. The lifecycle additions are scoped to this story to keep the change reviewable.

## Acceptance criteria

- [ ] `src/config/types.ts` adds 3 fields:
  ```ts
  time_grid_max_days: 1 | 3 | 7;                  // default 7
  time_grid_breakpoint_three_day_px: number;      // default 500
  time_grid_breakpoint_seven_day_px: number;      // default 900
  ```
- [ ] `src/config/config.ts` adds matching `DEFAULT_CONFIG` entries
- [ ] `src/config/config.ts` `hasConfigChanged` does **not** add these fields (they affect rendering only, not the fetch). They cause re-render via Lit's reactive prop diffing on `this.config`.
- [ ] `src/calendar-card-pro.ts` adds private fields:
  ```ts
  private _resizeObserver?: ResizeObserver;
  private _resizeRafId?: number;
  ```
- [ ] New private method `_syncObserver()`:
  - When `config.view === 'time-grid'` and `this.isConnected`: create observer if not present, observe `this`
  - Otherwise: disconnect observer if present
- [ ] New private method `_onResize(entries)`:
  - Coalesce via `requestAnimationFrame` (skip if `_resizeRafId !== undefined`)
  - In RAF: read `entries[0]?.contentBoxSize?.[0]?.inlineSize ?? entries[0]?.contentRect.width ?? this.offsetWidth`
  - Call `_applyVisibleDays(widthPx)`
- [ ] New private method `_applyVisibleDays(widthPx)`:
  - Calls `Grid.chooseVisibleDays(widthPx, config.time_grid_breakpoint_three_day_px, config.time_grid_breakpoint_seven_day_px, config.time_grid_max_days)`
  - Updates `this.visibleDays` only if the value changed (avoids unnecessary re-renders)
- [ ] `connectedCallback` (after `super.connectedCallback()`):
  - Call `_syncObserver()`
  - If `config.view === 'time-grid'`: call `_applyVisibleDays(this.offsetWidth)` synchronously to seed initial value before first render
- [ ] `disconnectedCallback`:
  - Disconnect observer; clear it
  - Cancel pending RAF if `_resizeRafId !== undefined`
- [ ] `updated(changedProps)`:
  - When `config.view` changes: call `_syncObserver()`; if newly time-grid, call `_applyVisibleDays(this.offsetWidth)`
- [ ] **`chooseVisibleDays` width=0 fallback** (verified in epic00 story0-2 tests; this story just relies on the existing behavior): width=0 returns `cap`, not 1 — avoids "flash of N=1 then N=cap" when card mounts in hidden tab
- [ ] Renderer (`render-grid.ts`) markup updated so the nav header conditionally hides single-step buttons when `visibleDays === 7` (per FR-4.1: 7-day mode shows only `<<` `Today` `>>`):
  ```ts
  ${visibleDays !== 7
    ? html`<button @click=${() => ctx.onShiftDay(-1)} ...>‹</button>`
    : nothing}
  ```
  *(Real navigation handlers come in story1-2; for this story `onShiftDay` is still no-op from epic00.)*
- [ ] No tests added in this story for the lifecycle (Lit lifecycle requires jsdom + observer mock — out of scope per design doc §10)
- [ ] Manual smoke test: resize browser from narrow to wide, column count changes 1 → 3 → 7 within ~1 frame of the resize stopping

## Out of scope

- Real navigation handlers (story1-2)
- Window-alignment math (story1-3)
- Fetch-window decoupling (story1-4)
- Editor surfacing of the 3 new fields (epic03)

## Technical notes

- **Why `connectedCallback` not `firstUpdated`**: Lit's `firstUpdated` runs *after* the first render. Setting `visibleDays` there requires a second render. `connectedCallback` runs before first render scheduling — reading `this.offsetWidth` forces a synchronous layout pass and gives a valid width.
- **Width=0 case**: when card mounts in a hidden tab or before parent layout, `offsetWidth` is 0. `chooseVisibleDays(0, ...)` returns `cap` (best guess). When the tab becomes visible, `ResizeObserver` fires with the real width and updates if different. This was design-doc bug v4-F2.
- **RAF coalescing**: ResizeObserver internally coalesces (one callback per frame max), but the RAF guard is defense-in-depth.
- **`isConnected` check in `_syncObserver`**: matters when called from `setConfig` before `connectedCallback` — observer creation deferred until connection.

## Files touched

```
src/config/types.ts                +3 fields
src/config/config.ts               +3 DEFAULT_CONFIG entries
src/calendar-card-pro.ts           +ResizeObserver lifecycle (~50 lines)
src/rendering/render-grid.ts       conditional button visibility in nav header (~5 lines)
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean
- `npm run build` succeeds
- Manual smoke test passes for 3 widths (320px, 700px, 1200px)
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` prefix)

## Mapping

- **Design doc**: §6.5 (host wiring — observer portion), FR-3.1 through FR-3.5
- **Acceptance specs**: G-3.1, G-3.1b
- **AGENTS.md**: Rule 1 (validate offsetWidth-in-connectedCallback claim by reading Lit lifecycle docs)
