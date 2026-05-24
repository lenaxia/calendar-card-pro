# Story 0-3 — Config Schema Additions

**Epic**: [epic00 — Time-Grid Base View](README.md)
**Status**: Not started
**Estimate**: S (small — schema-only, ~1 hour)
**Depends on**: None (parallelizable with story0-2)

---

## User story

> **As a** YAML user of calendar-card-pro,
> **I want** to set `view: 'time-grid'` and customize basic grid layout (hour range, slot interval, min event height) in my config,
> **So that** I can opt into the new view without writing code or installing extra integrations, and the existing list-view default works unchanged.

## Why this is needed

The grid view needs a config flag to opt in. Adding the schema first (without the renderer) lets us merge a small, mechanical change ahead of bigger commits. After this story:
- YAML `view: 'time-grid'` is accepted by `setConfig` but produces no visible change yet
- All grid-related fields are typed and have defaults

This decouples the schema from the rendering work and gives reviewers an easy first commit.

## Acceptance criteria

- [ ] `src/config/types.ts` adds the following fields to the `Config` interface (all top-level scalars per AGENTS.md "no nested objects"):
  ```ts
  view: 'list' | 'time-grid';                      // default 'list'
  time_grid_start_hour: number;                    // 0..23, default 6
  time_grid_end_hour: number;                      // 1..24, default 22
  time_grid_interval_minutes: 15 | 30 | 60;        // default 30
  time_grid_event_min_height_px: number;           // pixels, default 24
  time_grid_show_now_line: boolean;                // default true (used by epic02)
  ```

  *Note: fields used only in epic01 (`time_grid_max_days`, `time_grid_navigation_days`, breakpoints) and epic02 (`time_grid_allday_bg_opacity`) are NOT added in this story; they're added by their respective epics. Adding them now would create unused config surface.*

- [ ] `src/config/config.ts` adds matching entries to `DEFAULT_CONFIG` (all required for `filterDefaultValues` to omit defaults from saved YAML)
- [ ] `setConfig` validates `view`: any value other than `'list'` or `'time-grid'` is silently coerced to `'list'`, with a `Logger.warn` (FR-1.4)
- [ ] `setConfig` validates hour range: enforces `0 ≤ start_hour ≤ 23, 1 ≤ end_hour ≤ 24, start < end`. Invalid values reset BOTH to defaults (6, 22) with a `Logger.warn` (FR-2.3)
- [ ] `setConfig` validates `time_grid_interval_minutes`: only 15, 30, 60 accepted; invalid → 30 with warn
- [ ] `hasConfigChanged` is **not** modified in this story (no fetch-affecting fields added yet — those come in epic01 with `time_grid_navigation_days`)
- [ ] No render dispatch added yet; the `view: 'time-grid'` setting has no visible effect (intentional — story0-5 wires the dispatch)

## Out of scope

- Render dispatch (story0-5)
- The `time_grid_max_days`, `time_grid_navigation_days`, `time_grid_breakpoint_*_px` fields (epic01)
- The `time_grid_allday_*` fields (epic02)
- Editor UI for any of these fields (epic03)

## Technical notes

- **Why flat scalars**: `setConfig` does `{ ...DEFAULT_CONFIG, ...config }` (shallow merge) at `src/calendar-card-pro.ts:478`. Nested objects lose their default values when the user provides a partial nested object. This was design-doc bug v2-C1; the fix is "always flat scalars". The existing `weather` field gets a special-case deep-clone in `helpers.ts:346`; we don't add more such cases.
- **Validation in `setConfig`**: place the validation block **between line 482 (the `let mergedConfig = {...}` merge) and line 488 (`this.config = mergedConfig` assignment)**. The block mutates `mergedConfig` in place — fixing invalid values to defaults — so that downstream `instanceId` regen and `hasConfigChanged` see only valid values. Sketch:
  ```ts
  let mergedConfig = { ...Config.DEFAULT_CONFIG, ...config };

  // Validate view (FR-1.4)
  if (mergedConfig.view !== 'list' && mergedConfig.view !== 'time-grid') {
    Logger.warn(`Invalid view '${mergedConfig.view}', falling back to 'list'`);
    mergedConfig.view = 'list';
  }

  // Validate hour range (FR-2.3): 0 <= start <= 23, 1 <= end <= 24, start < end
  const sh = mergedConfig.time_grid_start_hour;
  const eh = mergedConfig.time_grid_end_hour;
  if (!Number.isInteger(sh) || sh < 0 || sh > 23 ||
      !Number.isInteger(eh) || eh < 1 || eh > 24 || sh >= eh) {
    Logger.warn(`Invalid hour range start=${sh}, end=${eh}; resetting to defaults`);
    mergedConfig.time_grid_start_hour = 6;
    mergedConfig.time_grid_end_hour = 22;
  }

  // Validate interval (FR-2.4): only 15, 30, 60
  if (![15, 30, 60].includes(mergedConfig.time_grid_interval_minutes)) {
    Logger.warn(`Invalid interval ${mergedConfig.time_grid_interval_minutes}; using 30`);
    mergedConfig.time_grid_interval_minutes = 30;
  }

  this.config = mergedConfig;
  ```
- **Why `Logger.warn` not throw**: existing setConfig is tolerant — it never throws. Matching that style.

## Files touched

```
src/config/types.ts          +6 fields
src/config/config.ts         +6 DEFAULT_CONFIG entries
src/calendar-card-pro.ts     setConfig validation block (~15 lines)
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean
- `npm run build` succeeds
- Manual smoke test: existing list view works with no change; YAML `view: 'time-grid'` parses without error and renders the **list view** (no dispatch yet)
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` prefix)

## Mapping

- **Design doc**: §5 (schema), FR-1.1, FR-1.4, FR-2.3, FR-2.4
- **AGENTS.md**: Rule 1 (validate assumptions), Rule 6 (no `any`), "no nested objects in Config"
- **Acceptance specs**: G-1.4, G-hours
