# Story 0-4 — `render-grid.ts` Rendering Module

**Epic**: [epic00 — Time-Grid Base View](README.md)
**Status**: Not started
**Estimate**: L (large — primary rendering work, ~1 day)
**Depends on**: [story0-2](story0-2.md), [story0-3](story0-3.md)

---

## User story

> **As a** developer wiring up the time-grid feature,
> **I want** a pure render function `renderTimeGrid(events, config, language, ctx, hass?): TemplateResult` that converts events + config + injected context into a complete Lit `TemplateResult`,
> **So that** the host component can dispatch to it without owning any layout math, and the renderer stays testable as a pure function of its inputs.

## Why this is needed

This is the core rendering work. After this story exists, `view: 'time-grid'` will *actually* render a grid — not just be accepted by setConfig. The renderer is intentionally pure: all DOM/lifecycle concerns stay in the host (story0-5), so the render module can be reasoned about and re-used by epic01/02 additions without modification.

Per the design doc, this story renders **only the grid body and timed events**. All-day banners (epic02), now-line (epic02), and navigation header (epic01) are emitted as empty placeholders or omitted entirely; their stories add real content without changing this module's external API.

## Acceptance criteria

- [ ] New file `src/rendering/render-grid.ts` exports `renderTimeGrid` and `TimeGridContext`:
  ```ts
  export function renderTimeGrid(
    events: ReadonlyArray<Types.CalendarEventData>,
    config: Types.Config,
    language: string,
    ctx: TimeGridContext,
    hass?: Types.Hass | null,
  ): TemplateResult;

  export interface TimeGridContext {
    visibleDays: 1 | 3 | 7;       // for this epic, always 7 (responsive arrives in epic01)
    offsetDays: number;            // for this epic, always 0
    now: Date;
    onShiftDay: (delta: -1 | 1) => void;       // accepted but no-op in epic00
    onShiftWindow: (delta: -1 | 1) => void;     // ditto
    onResetToToday: () => void;                  // ditto
    canShiftBack: boolean;
    canShiftForward: boolean;
  }
  ```
- [ ] Internal flow:
  1. **Build the visible-day window** via `Grid.snapToWindow`:
     ```ts
     const reference = Grid.getReferenceDate(config);
     const firstDayOfWeek = FormatUtils.getFirstDayOfWeek(config, hass) as 0 | 1;
     const { start: windowStart, days } = Grid.snapToWindow(
       reference, ctx.offsetDays, ctx.visibleDays, firstDayOfWeek,
     );
     // `days` is the array of N midnight Dates that become the day-columns
     ```
     Using `snapToWindow` from day one (not naive `now + offsetDays`) means the renderer's day-array logic doesn't change in epic01 — epic01 just passes different `visibleDays`/`offsetDays` values.
  2. Filter `events` to the visible window (keep only events whose start or end falls within `[windowStart, windowStart + visibleDays * 1day)`)
  3. Apply `show_past_events: false` filter for **timed past events only** (per FR-2.11)
  4. Split timed events crossing midnight via `Grid.splitTimedEventByDay`
  5. For each day column: compute `EventPlacement` per event, run `Grid.layoutOverlaps`, apply `past-event` class via `Grid.isPastEvent(event, ctx.now)`
  6. Determine `todayIdx`: `Grid.daysBetween(windowStart, startOfDay(ctx.now))`; valid only if `0 <= todayIdx < visibleDays`, otherwise `-1` (today not visible)
  7. Emit Lit `html` (see markup spec below)
- [ ] Markup includes:
  - `.ccp-grid` (root)
  - `.ccp-grid-nav` (placeholder buttons; epic01 fills them; for now: only `Today` button + range label, with `<` `>` `<<` `>>` rendered as `nothing` since `canShiftBack`/`canShiftForward` are false)
  - `.ccp-grid-headers` (axis spacer + day-of-week + day-of-month per column; first-of-month also shows month name)
  - **`.ccp-grid-allday` strip is `nothing` (omitted entirely) in epic00.** No all-day banner rendering yet — epic02 swaps `nothing` for real banner rendering. Per FR-6.3 the strip should always be omitted when no banners exist anyway.
  - `.ccp-grid-body` with `.ccp-grid-time-axis` + `.ccp-grid-columns`
  - `.ccp-grid-day-column` per visible day, with `today` class when `i === todayIdx`
  - `.ccp-grid-event` per event, with inline `styleMap` for `top`/`height`/`left`/`width`
  - Now-line element: NOT rendered in this epic (epic02 adds it)
- [ ] `grid-template-columns` set inline via `styleMap` (NOT via `repeat(var(--n))`)
- [ ] Hour-axis labels via `formatHourLabel(hour, use24h)`; range `[start_hour, end_hour - 1]` (excludes `end_hour` to avoid hour-24 edge case)
- [ ] Per-event content uses progressive disclosure:
  - Always: title (truncated)
  - When `heightPx ≥ 32px`: + start-end time
  - When `heightPx ≥ 56px`: + location (if `getEntitySetting(event._entityId, 'show_location', config, event)` is true)
- [ ] Empty events (`events.length === 0`): renders headers + axis + columns; no event blocks (FR-2.12)
- [ ] No imports from DOM/HA APIs except types; no `document.querySelector` or similar (the host owns DOM mutation)

## Out of scope

- Responsive `visibleDays` switching (epic01)
- Real navigation handlers (epic01 — for this epic, the buttons just render disabled)
- Window alignment logic for N=7 week-aligned vs N=1/3 rolling (epic01; this epic always renders 7 days starting at `today`)
- All-day banner rendering (epic02 — this epic emits an empty `.ccp-grid-allday` placeholder)
- Now-line element (epic02)
- All-day strip overflow indicators / `time_grid_allday_bg_opacity` (epic02)

## Technical notes

- **Pure function**: take `now: Date` from `ctx`, NEVER call `new Date()` inside the renderer (testability)
- **No DOM access**: the renderer returns a `TemplateResult`; commit is Lit's job
- **`splitTimedEventByDay`** is called inside the renderer (not in the host) so the host doesn't need to know about cross-midnight events
- **Per-entity setting resolution**: use `EventUtils.getEntitySetting(entityId, 'show_location', config, event) ?? config.show_location` (mirrors `events.ts:241`)
- **List-view path**: this story does NOT modify `src/rendering/render.ts` (FR-1.2 invariant)
- **CSS classes**: defined in story0-6; this story just emits classes that match

## Files touched

```
src/rendering/render-grid.ts    new (~250 lines)
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean (test files in `test/` not affected)
- `npm run build` succeeds; bundle delta ~6-8 KB minified
- Manual smoke test (after story0-5 wires it): a YAML config with `view: 'time-grid'` shows a 7-day grid with timed events at correct positions
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` prefix)

## Mapping

- **Design doc**: §6.4 (renderer surface), FR-2.x, FR-9.3 (inline styleMap)
- **Acceptance specs**: G-2.5/2.5b/2.6a-f, G-2.9*, G-2.12, G-pastEventsFilter (the timed-only filter half)
- **AGENTS.md**: Rule 5 (list view untouchable), Rule 7 (no inline comments restating code)
