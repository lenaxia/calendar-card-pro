# Work Log 0005 — Story 0-3: Config Schema Additions

**Date**: 2026-05-22
**Story**: [docs/epics/epic00/story0-3.md](../epics/epic00/story0-3.md)
**Status**: Implementation complete; tests/lint/build green; not committed (user will commit after validation pass)

---

## Summary

Added six top-level scalar fields to the `Config` schema for the time-grid view (`view`,
`time_grid_start_hour`, `time_grid_end_hour`, `time_grid_interval_minutes`,
`time_grid_event_min_height_px`, `time_grid_show_now_line`), with matching
`DEFAULT_CONFIG` entries and a validation block in `setConfig` that coerces invalid
values back to defaults with `Logger.warn`. No render dispatch, no `hasConfigChanged`
update, no editor UI — all per story scope.

## Files modified

| File | Change |
|---|---|
| `src/config/types.ts` | +14 lines: new `// Time-grid view` block with 6 JSDoc'd fields placed between `// Weather` and `// Actions` |
| `src/config/config.ts` | +8 lines: matching `// Time-grid view` block in `DEFAULT_CONFIG` |
| `src/calendar-card-pro.ts` | +30 lines: validation block in `setConfig` between the deprecated-params comment block and `this.config = mergedConfig` |

## Verified-vs-assumed table

| Claim | How verified | Status |
|---|---|---|
| `Config` interface lives at `src/config/types.ts:14-119` | Read entire file | ✅ Verified |
| `DEFAULT_CONFIG` lives at `src/config/config.ts:16-143` | Read entire file | ✅ Verified |
| `setConfig` is at `src/calendar-card-pro.ts:478` | Read lines 450-519 | ✅ Verified |
| `let mergedConfig = { ...Config.DEFAULT_CONFIG, ...config }` is line 482 | Read | ✅ Verified |
| `this.config = mergedConfig` was line 488 (now shifted to 526 after insert) | Read | ✅ Verified |
| Logger module imported as `import * as Logger from './utils/logger'` (line 37) | grep | ✅ Verified |
| `Logger.warn(message: string, ...data: unknown[])` exists at `src/utils/logger.ts:207` | Read | ✅ Verified |
| Numeric literal union `15 \| 30 \| 60` is valid TS in interface fields | Compiled successfully via build | ✅ Verified |
| Existing `Config` uses single-line `// Section name` comment headers (e.g. `// Weather`, `// Actions`) | Read types.ts | ✅ Verified |
| `setConfig` is tolerant — never throws — and we matched that with `Logger.warn` + coerce | Read setConfig at :478, no `throw` in path | ✅ Verified |
| Existing `DEFAULT_CONFIG` groups fields with section headers like `// Weather`, `// Actions`, `// Cache and refresh settings` | Read config.ts | ✅ Verified |
| Next worklog sequence is `0005` | `ls docs/design/` shows 0001..0004 | ✅ Verified |
| `src/rendering/render.ts` is not modified (Rule 5) | `git diff --stat` empty | ✅ Verified |
| `src/utils/events.ts` is not modified (Rule 5) | `git diff --stat` empty | ✅ Verified |
| `hasConfigChanged` not modified (story line 42) | Did not edit `src/config/config.ts:209-246` | ✅ Verified |
| No render dispatch added (story line 43) | Did not modify any render() in calendar-card-pro.ts | ✅ Verified |

## Validation behavior table

| User config (after merge) | Coerced result | Warning emitted? |
|---|---|---|
| `view: 'list'` | `'list'` | No |
| `view: 'time-grid'` | `'time-grid'` | No |
| `view: 'foo'` | `'list'` | Yes — `Invalid view 'foo', falling back to 'list'` |
| `view: undefined` (omitted) | `'list'` (DEFAULT_CONFIG) | No |
| `time_grid_start_hour: 6, time_grid_end_hour: 22` | unchanged | No |
| `time_grid_start_hour: 0, time_grid_end_hour: 24` | unchanged | No |
| `time_grid_start_hour: -1` | reset both to 6/22 | Yes |
| `time_grid_start_hour: 24` | reset both to 6/22 | Yes — fails `sh > 23` |
| `time_grid_end_hour: 0` | reset both to 6/22 | Yes — fails `eh < 1` |
| `time_grid_end_hour: 25` | reset both to 6/22 | Yes — fails `eh > 24` |
| `time_grid_start_hour: 10, time_grid_end_hour: 10` | reset both to 6/22 | Yes — fails `sh < eh` (sh >= eh) |
| `time_grid_start_hour: 22, time_grid_end_hour: 6` | reset both to 6/22 | Yes — start after end |
| `time_grid_start_hour: 6.5` | reset both to 6/22 | Yes — fails `Number.isInteger` |
| `time_grid_start_hour: '6'` (string) | reset both to 6/22 | Yes — fails `Number.isInteger` |
| `time_grid_interval_minutes: 15` | unchanged | No |
| `time_grid_interval_minutes: 30` | unchanged | No |
| `time_grid_interval_minutes: 60` | unchanged | No |
| `time_grid_interval_minutes: 5` | reset to 30 | Yes |
| `time_grid_interval_minutes: 45` | reset to 30 | Yes |
| `time_grid_interval_minutes: 'half-hour'` | reset to 30 | Yes |
| `time_grid_event_min_height_px: <any>` | unchanged (no validation in scope) | No |
| `time_grid_show_now_line: <any>` | unchanged (no validation in scope) | No |

Note: `time_grid_event_min_height_px` and `time_grid_show_now_line` are not validated
in this story because the story acceptance criteria only require validation for `view`,
the hour range, and the interval. Defensive validation for those fields belongs to a
later story (or is a non-issue if the renderer treats them robustly).

## Build / lint / test results

| Command | Result |
|---|---|
| `npm run lint` | clean — zero warnings, zero errors |
| `npm test` | `1 file passed`, `53 tests passed` (unchanged from story 0-2 baseline) |
| `npm run build` | succeeded — `dist/calendar-card-pro.js` produced in 9.2s |
| `git diff --stat -- src/rendering/render.ts` | empty (Rule 5 satisfied) |
| `git diff --stat -- src/utils/events.ts` | empty (Rule 5 satisfied) |

## Deviations from the story

None. The validation block was placed **after** the existing
`END OF DEPRECATED PARAMETERS HANDLING` comment block (rather than before it) because
that block is a marker for legacy-param transformation that has logically already
finished by then; placing the new validation after it preserves the semantic ordering
"merge → handle deprecated → validate new fields → assign", which keeps the deprecated
section self-contained and keeps the new validation contiguous with the new fields it
operates on. The story explicitly permits placement "either before or after" the
deprecated block.

## Out-of-scope items not added (per story lines 47–49)

- `time_grid_max_days` (epic01)
- `time_grid_navigation_days` (epic01)
- `time_grid_breakpoint_three_day_px` / `time_grid_breakpoint_seven_day_px` (epic01)
- `time_grid_allday_bg_opacity` and other allday fields (epic02)
- Editor UI for any of the new fields (epic03)
- `hasConfigChanged` update (deferred to epic01 when fetch-affecting fields land)
- Render dispatch on `config.view === 'time-grid'` (story 0-5)

## Open questions / follow-ups

- **Manual HA smoke test (story line 98)** is deferred to PR review / a real HA
  instance: confirm existing list view renders unchanged with the new schema in
  place, and that YAML `view: 'time-grid'` parses without error and still
  renders the list view (since story 0-5 has not yet wired the dispatch). No
  automated coverage is added in this story; the lint+build+unit-test triplet
  passing is the strongest pre-merge signal we have until story 0-5 lands.

The next stories in epic00 (0-4 onwards) will consume the new `view` field via
the render dispatch and pure helpers already landed in story 0-2.
