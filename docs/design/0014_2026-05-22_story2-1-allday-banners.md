# Story 2-1 — All-day Banner Placement + Overflow Indicators

**Date**: 2026-05-22
**Story**: [docs/epics/epic02/story2-1.md](../epics/epic02/story2-1.md)
**Status**: Implementation complete; awaits user validation/commit.

## Files modified

| File | Change |
|---|---|
| `src/utils/grid.ts` | +`BannerPlacement` interface, +`computeBannerPlacement` pure helper (~57 lines) |
| `test/utils/grid.test.ts` | +5 tests covering G-2.7a/b/c/d + invisible case |
| `src/config/types.ts` | +1 field `time_grid_allday_bg_opacity: number` |
| `src/config/config.ts` | +1 `DEFAULT_CONFIG` entry: `20` (0..100 scale; see "Opacity scale resolution" below) |
| `src/rendering/render-grid.ts` | Replaced `${nothing}` placeholder with banner strip; +`buildAllDayBanners` + `renderAllDayBanner` helpers (~75 lines net) |
| `src/rendering/styles.ts` | +banner CSS (`.ccp-grid-allday-banner`, `.past-event`, `.ccp-grid-allday-overflow`) |

`src/rendering/render.ts` and `src/utils/events.ts` were **not** touched — verified by `git diff --stat HEAD` (Rule 5 invariant preserved).

## Verified vs. assumed

| Assumption | How verified | Status |
|---|---|---|
| `parseAllDayDate` returns local midnight | `src/utils/format.ts:196-202` (re-read) | ✅ |
| `daysBetween` uses `Math.round` (DST-safe) | `src/utils/grid.ts:88` | ✅ |
| `isPastEvent` already does iCal exclusive-end adjustment for all-day events | `src/utils/grid.ts:381-395` | ✅ |
| `getEntityAccentColorWithOpacity(entityId, config, opacity, event)` signature | `src/utils/events.ts:948-953` | ✅ |
| Existing all-day strip placeholder is `${nothing}` between headers and body | `src/rendering/render-grid.ts:195` (pre-edit) | ✅ |
| `ctx.now` is the canonical clock — never call `new Date()` in render-grid | `src/rendering/render-grid.ts:31` (Types interface) | ✅ |
| `_matchedConfig` fast-path lookup needs `event` 4th arg | `src/utils/events.ts:957-959` | ✅ |
| `headerColumns` uses same template as body for axis-spacer + day cols | `src/rendering/render-grid.ts:111` (existing) | ✅ |
| Existing `.ccp-grid-allday` rule already provides `max-height` + `overflow:hidden` from story 0-6 | `src/rendering/styles.ts:785-788` | ✅ |
| `time_grid_allday_bg_opacity` scale | story spec said `0..1, default 0.2`, but `convertToRGBA` divides by 100 — see resolution below | ⚠ Resolved as `0..100, default 20` |

## Opacity scale resolution (0..1 → 0..100)

The story spec at `docs/epics/epic02/story2-1.md:28` defined
`time_grid_allday_bg_opacity` as `0..1` with `default 0.2`. However, the
existing utility used to colour banners (`getEntityAccentColorWithOpacity`
→ `convertToRGBA`) treats the `opacity` argument as **`0..100`** and
divides by `100` internally:

- `src/utils/helpers.ts:23` — `rgba(..., ${opacity / 100})`
- `src/utils/helpers.ts:47` — `rgba(${r}, ${g}, ${b}, ${opacity / 100})`
- The sibling field `event_background_opacity` already uses the same
  `0..100` convention (`src/config/config.ts:81` default `0`).
- `getEntityAccentColorWithOpacity`'s JSDoc at `events.ts:944` explicitly
  says "Opacity value (0-100)".

Following the spec literally with `default 0.2` would have passed `0.2` to
`convertToRGBA`, producing an RGBA alpha of `0.002` — banners would have
appeared essentially transparent.

**Resolution**: changed default to `20` (0..100 scale) to match the existing
convention. The shipped JSDoc at `src/config/types.ts:130-136` documents the
0..100 scale explicitly. Per AGENTS.md "hierarchy of authority" ("source code
wins for how it works today; update design doc to match"), the design doc and
story spec carry stale `0..1` references that should be cleaned up in a
follow-up doc-only pass:

- `docs/epics/epic02/README.md:23,58`
- `docs/epics/epic02/story2-1.md:28`
- `docs/design/time-grid-view.md:89,239,409,588,1368`
- `docs/epics/epic03/story3-2.md:47`
- `docs/epics/epic03/story3-3.md:76`
- `docs/design/0001_2026-05-20_time-grid-view-design.md:43`

Visual outcome: with default `20`, the banner background renders at
`rgba(..., 0.2)` — the visually intended subtle tint.

## Test counts

| | Before | After |
|---|---|---|
| `test/utils/grid.test.ts` | 73 | 78 |
| `test/config/config.test.ts` | 5 | 5 |
| **Total** | **78** | **83** |

## Spec G-2.7 outcomes

All four spec cases pass under the new helper:

| Spec | Window | Event | Expected | Actual |
|---|---|---|---|---|
| G-2.7a | May 11–17 | May 13–16 inclusive | `dayIdx=2, numDays=4` | ✅ Pass |
| G-2.7b | May 11–17 | May 09–13 inclusive | `dayIdx=0, numDays=3, startedBefore=true` | ✅ Pass |
| G-2.7c | May 11–17 | May 16–20 inclusive | `dayIdx=5, numDays=2, continuesAfter=true` | ✅ Pass |
| G-2.7d | May 11–17 | May 09–20 inclusive | `dayIdx=0, numDays=7, both flags true` | ✅ Pass |
| invisible | May 11–17 | May 01–05 inclusive | `visible=false, numDays=0` | ✅ Pass |

## Build / lint / test results

```
npm run lint     → clean (no warnings, no errors)
npm test         → 83 passed (2 files, 0 failures)
npm run build    → success (306,954 bytes vs 305,037 baseline = +1,917 bytes ≈ +1.9 KB)
```

Bundle delta is ~1.9 KB — slightly under the story's ~3-4 KB estimate (the supporting infrastructure for the all-day strip already existed from epic00 story0-6 + story1-3).

## Banner rendering pipeline

1. `renderTimeGrid` calls `buildAllDayBanners(events, windowStart, ctx.visibleDays)` once per render pass.
2. `buildAllDayBanners`:
   - Filters to all-day events (`!event.start.dateTime && event.start.date && event.end?.date`).
   - For each, parses start/end via `FormatUtils.parseAllDayDate`, applies the iCal exclusive-end adjustment (`-1` day) to make the end inclusive.
   - Calls `Grid.computeBannerPlacement` (the new pure helper) and skips `!visible` results.
   - Sorts banners by `eventStartDay` ASC, then by `originalSpan` DESC (longer banners first → simpler events nest visually) per story line 70.
3. The renderer emits `${nothing}` for the strip when no banners are visible (FR-6.3); otherwise emits a `<div class="ccp-grid-allday">` with the same `gridTemplateColumns` template as the headers (axis-spacer + N day columns).
4. Each banner is a `<div class="ccp-grid-allday-banner [past-event]">` with inline `gridColumnStart=dayIdx+2`, `gridColumnEnd=span numDays`, `backgroundColor=accentBg`. Overflow indicators (◂ / ▸) are added inline based on the placement flags.
5. `Grid.isPastEvent(event, ctx.now)` adds the `past-event` class regardless of `show_past_events` (FR-2.11 — that filter only applies to timed events).

## Manual smoke test — DEFERRED

UI smoke tests (multi-day banner across columns, single-day banner, ◂/▸ at clipped edges, dimmed past banner) are deferred per AGENTS.md rule 8 — they require running the card against a real HA instance. Code review covers the placement math (G-2.7a-d unit tests) and the rendering pipeline visually conforms to the story-line-57-to-68 spec.

## Open follow-ups

- Doc-only follow-up: update epic02/03 stories and design doc to consistently document `time_grid_allday_bg_opacity` as `0..100, default 20` (see "Opacity scale resolution" above for the list of files).
- Editor surface for `time_grid_allday_bg_opacity` is out of scope for this story.

## Constraints honoured

- `src/rendering/render.ts` unchanged (Rule 5)
- `src/utils/events.ts` unchanged (Rule 5)
- No `any` (Rule 6 — verified by `npm run lint`)
- No inline comments restating code (Rule 7)
- All banner code lives in `render-grid.ts`, not `render.ts`
- Pure helper (`computeBannerPlacement`) has tests written alongside (Rule 8)
