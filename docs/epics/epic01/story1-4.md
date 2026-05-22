# Story 1-4 — Fetch-Window Decoupling via `time_grid_navigation_days`

**Epic**: [epic01 — Responsive Columns + Navigation](README.md)
**Status**: Not started
**Estimate**: M (~half day)
**Depends on**: [story1-3](story1-3.md)

---

## User story

> **As a** user navigating forward and backward in the time-grid view,
> **I want** ~4 weeks of events available locally so navigation feels instant,
> **So that** I'm not waiting for a network refetch every time I click `>`.
>
> **As a** YAML user,
> **I want** the grid view's fetch range to be independent of `days_to_show` (which the list view uses for a different purpose),
> **So that** I don't have to compromise between "list shows 3 days" and "grid lets me navigate 4 weeks".

## Why this is needed

Without this story, the grid view fetches `days_to_show` events (default 3) — meaning navigation past day 3 shows empty columns. epic00 deliberately deferred this to keep that epic small. This story plumbs through a separate `time_grid_navigation_days` (default 28).

This is also where **`hasConfigChanged` becomes view-aware** — toggling between list and grid view now correctly triggers a refetch (cache key changes due to different effective `daysToShow`), and changing `days_to_show` in grid mode is a no-op (avoids wasted refetches).

## Acceptance criteria

- [ ] `src/config/types.ts` adds:
  ```ts
  time_grid_navigation_days: number;     // default 28
  ```
- [ ] `src/config/config.ts` adds matching `DEFAULT_CONFIG` entry
- [ ] `src/utils/events.ts` `fetchEventData` adds an optional 5th parameter:
  ```ts
  export async function fetchEventData(
    hass: Types.Hass,
    config: Types.Config,
    instanceId: string,
    force = false,
    effectiveDaysToShow?: number,    // NEW
  ): Promise<Types.CalendarEventData[]> {
    const daysToShow = effectiveDaysToShow ?? config.days_to_show;
    // ... use daysToShow in:
    //   line ~39: getBaseCacheKey(... daysToShow ...)
    //   line ~61: getTimeWindow(daysToShow, config.start_date)
    //   line ~70: limitDate.setDate(... + daysToShow)
    // groupEventsByDay (line 326) is unchanged — only used by list view
  }
  ```
- [ ] `src/calendar-card-pro.ts` `updateEvents` passes the override:
  ```ts
  const effectiveDays = this.config.view === 'time-grid'
    ? this.config.time_grid_navigation_days
    : undefined;

  const eventData = await EventUtils.fetchEventData(
    this.safeHass, this.config, this._instanceId, force,
    effectiveDays,
  );
  ```
- [ ] `src/config/config.ts` `hasConfigChanged` becomes **view-aware**. The existing `dataChanged` block at `src/config/config.ts:234-239`:
  ```ts
  // BEFORE (existing, lines ~234-239):
  const dataChanged =
    previousEntityIds !== currentEntityIds ||
    previous.days_to_show !== current.days_to_show ||
    previous.start_date !== current.start_date ||
    previous.show_past_events !== current.show_past_events ||
    previous.filter_duplicates !== current.filter_duplicates;
  ```
  Updated to:
  ```ts
  // AFTER:
  const isGridView = current.view === 'time-grid';
  const viewChanged = previous.view !== current.view;
  const dataChanged =
    viewChanged ||                                                         // view toggle triggers refetch
    previousEntityIds !== currentEntityIds ||
    (!isGridView && previous.days_to_show !== current.days_to_show) ||      // list view: days_to_show triggers
    (isGridView && previous.time_grid_navigation_days !== current.time_grid_navigation_days) ||  // grid view: nav_days triggers
    previous.start_date !== current.start_date ||
    previous.show_past_events !== current.show_past_events ||
    previous.filter_duplicates !== current.filter_duplicates;
  ```
  The function still returns `dataChanged || refreshIntervalChanged` (don't change the return statement). Logger debug message also unchanged.
- [ ] Test: spec G-hasConfigChanged (5 cases):
  - view list → time-grid (same other config) → `true` (view toggle)
  - view time-grid, days_to_show 3 → 5, no other changes → `false` (ignored in grid)
  - view list, days_to_show 3 → 5 → `true` (list-view refetch)
  - view list, nav_days 28 → 14 → `false` (ignored in list)
  - view time-grid, nav_days 28 → 14 → `true` (grid-view refetch)
- [ ] Existing list-view callers of `fetchEventData` (the only one is `updateEvents` itself) continue to work without passing the 5th arg — verified by `git diff` showing only the new conditional `effectiveDays` line + the new optional parameter signature

## Out of scope

- Editor UI for `time_grid_navigation_days` (epic03)
- Hint when `time_grid_navigation_days < time_grid_max_days` (epic03 — implemented in editor helper-text)
- Tests for the `effectiveDaysToShow` plumbing (would need to mock HA's `callApi`; manual smoke test sufficient)

## Technical notes

- **Why view-aware `hasConfigChanged`**: without it, toggling `view: list ↔ time-grid` doesn't trigger a refetch. The cache key would correctly point to a different slot (because `daysToShow` differs in `getBaseCacheKey`), so a fresh fetch happens *naturally* when `updateEvents` runs — but `updateEvents` doesn't run unless `hasConfigChanged` returns true. This was design-doc bug v9-F3.
- **Three callsites in `events.ts`**: cache key (line ~39), `getTimeWindow` (line ~61), post-fetch filter (line ~70). The bug is failing to update any one of them — the cache says "we have 28 days" but the time window says "fetch 3 days". This was design-doc bug v8-F2 (clarification of v6-F2).
- **`groupEventsByDay` unchanged**: it's only called from the list-view path, which always passes the un-overridden `config.days_to_show`. Grid view bypasses `groupEventsByDay` entirely (consumes `this.events` directly).
- **`instanceId` is generated from `days_to_show`**: when toggling views, `instanceId` doesn't change but the cache key has a different `daysToShow` suffix → different cache slots → no collision. Confirmed in design v3-F-3 review.
- **No invocation of editor or rendering code in this story** — it's a pure data-pipeline change. Visual effect: navigating past day 3 in grid view now shows real events instead of empty columns.

## Files touched

```
src/config/types.ts             +1 field
src/config/config.ts            +1 DEFAULT_CONFIG entry; hasConfigChanged updated (~12 lines)
src/utils/events.ts             +1 optional parameter, 3 callsites use override
src/calendar-card-pro.ts        updateEvents passes override (~5 lines)
test/config/config.test.ts      new file or extend existing — G-hasConfigChanged 5 cases
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean
- `npm test` passes (G-hasConfigChanged 5 cases)
- `npm run build` succeeds
- Manual smoke test 1: in grid view, `<<` `>>` shows real events out to day 28
- Manual smoke test 2: toggle `view: list ↔ time-grid` while watching network tab — cache hit on toggle back; fresh fetch on first toggle (different cache slot)
- Manual smoke test 3: change `days_to_show` while in grid view — no network refetch
- Manual smoke test 4: list view (no `view` set) shows the same events as before; `days_to_show` change still triggers refetch (existing behavior unchanged)
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` prefix)

## Mapping

- **Design doc**: §6.5 (`updateEvents` change), FR-5.4, FR-5.5
- **Acceptance specs**: G-5.4, G-hasConfigChanged
- **AGENTS.md**: Rule 1 (verify `events.ts` line numbers cited in design doc against actual source), Rule 2 (don't claim "no caller changes needed" — actually `updateEvents` IS a caller change, verify by reading `calendar-card-pro.ts:538`)
