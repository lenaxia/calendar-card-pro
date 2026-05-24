# Worklog 0004 — Story 0-2: Pure Helpers in `utils/grid.ts` (TDD)

**Date**: 2026-05-22
**Story**: [epic00/story0-2](../epics/epic00/story0-2.md) — Pure helpers in `src/utils/grid.ts`
**Status**: Implementation complete; ready for orchestrator validation
**Branch**: `feature/time-grid-week-view`

---

## What was done

Implemented all pure helpers required by epic00 in `src/utils/grid.ts`, written
test-first (TDD red → green). The helpers cover date math, responsive day-count
selection, event placement within the hour band, cluster-based overlap packing,
midnight-boundary splitting of timed events, reference-date computation, the
list-view `isPastEvent` semantics replicated, and hour-only axis label
formatting. No DOM, no Lit, no HA, no `events.ts` imports beyond the public
`getTimeWindow`.

### Files created/modified

| File | Change |
|---|---|
| `test/utils/grid.test.ts` | Replaced placeholder with 53 tests across 12 `describe` blocks. Each test cites the relevant spec ID from `docs/design/time-grid-view.md` §8 in its name where applicable (e.g. `G-2.5`, `G-2.9d`, `G-hourLabel`). |
| `src/utils/grid.ts` | New (~330 lines incl. JSDoc). Exports `SLOT_HEIGHT_PX`, `EventPlacement`, `OverlapInput`, `LayoutResult<T>`, and 12 functions per the story acceptance criteria. |

### Files NOT modified

- `src/rendering/render.ts` — `git diff --stat` empty (Rule 5 hard invariant).
- `src/utils/events.ts` — `git diff --stat` empty. `getTimeWindow` is consumed
  but not changed (the optional `effectiveDaysToShow` arg is story 0-5, not now).
- `package.json`, `tsconfig.json`, `eslint.config.mjs` — unchanged from story 0-1.

---

## Assumptions table — verified vs. assumed

| Assumption | Verified by | Status |
|---|---|---|
| Test framework is Vitest 2.1.x | `package.json:55`, story 0-1 worklog | ✅ Verified |
| `CalendarEventData.start.dateTime` is ISO string; `start.date` is `YYYY-MM-DD` | `src/config/types.ts:212-214` (read directly) | ✅ Verified |
| `parseAllDayDate` returns local midnight via `new Date(year, month-1, day)` | `src/utils/format.ts:196-202` (read directly) | ✅ Verified |
| `getTimeWindow(daysToShow, startDate)` returns `{start, end}` with `start` at local midnight | `src/utils/events.ts:1205-1239` (read directly) | ✅ Verified |
| `getStartDateReference` private behavior: when `start_date` empty, use today at local midnight; otherwise use `getTimeWindow(...).start` | `src/utils/events.ts:1486-1497` (read directly) | ✅ Verified — replicated 1:1 in `getReferenceDate` |
| `isPastEvent` semantics: timed = `now > endDateTime`; all-day = adjusted `today > endDate` | `src/rendering/render.ts:800-832` (read directly) | ✅ Verified — replicated in `isPastEvent` |
| `Math.round` (not `Math.floor`) for `daysBetween` | AGENTS.md §"Common Mistakes" #4 + Rule 1 v10-F2 example | ✅ Verified — node REPL probe `(2026-03-08, 2026-03-09) → round=1, floor=0` |
| `@typescript-eslint/no-explicit-any: error` enforced | `eslint.config.mjs:31` | ✅ Verified — zero `any` in delivered files |
| `sort-imports` with `ignoreMemberSort:false` enforces alphabetical member order | `eslint.config.mjs:42-51` | ✅ Verified — test imports written alphabetically |
| TS target ES2017 disallows `Array.prototype.flat` (ES2019) | `tsconfig.json:3,6` | ✅ Verified — no `flat` used; only `for` loops, `map`, `sort`, spread |
| src files use **relative** imports, not `@utils/*` aliases | `grep -rn "from '@" src/` returned only `@mdi/js` (an external pkg) | ✅ Verified — see "Decisions" §1 |
| Vitest has no path-alias config (no `vitest.config.*` exists) | `find /vitest.config*` empty (only `node_modules/vitest`) | ✅ Verified — see "Decisions" §1 |
| Spreading event preserves all metadata fields (`summary`, `description`, `_entityId`, `_matchedConfig`, …) | TS structural type via `{ ...event, start: …, end: … }`; tested in G-2.8a | ✅ Verified — explicit assertion in test |
| `splitTimedEventByDay` must drop zero-duration segment when event ends exactly at midnight | Story line 32; design spec G-2.8b | ✅ Verified — explicit `segEnd > segStart` guard, tested |
| `chooseVisibleDays(0, …)` returns `cap` (no-measurement fallback) | Design spec G-3.1b | ✅ Verified — first branch in implementation, tested |
| Half-open intervals: A ending at T does not overlap B starting at T | Design spec G-2.9b ("strict `<`") | ✅ Verified — `clusterLaneEnds[l] <= ev.startMin` accepts touch as free; `ev.startMin >= clusterMaxEnd` ends cluster on touch |

---

## Test counts

| Phase | Test files | Tests run | Pass | Fail | Skipped |
|---|---|---|---|---|---|
| RED (before `src/utils/grid.ts` existed) | 1 | 0 (suite failed to load — import unresolved) | 0 | 1 (suite) | 0 |
| GREEN (after implementation) | 1 | 53 | 53 | 0 | 0 |

```
$ npm test     # GREEN
 ✓ test/utils/grid.test.ts (53 tests) 31ms
 Test Files  1 passed (1)
      Tests  53 passed (53)
```

The 53 cases break down per the acceptance criteria minimums in story0-2.md:38-50:

| Group | Min required | Delivered |
|---|---|---|
| `SLOT_HEIGHT_PX` | (constant) | 1 |
| `minutesFromMidnight` | 3 | 3 |
| `startOfDay` | 1 | 1 |
| `daysBetween` | 5 | 5 |
| `startOfWeek` | 3 | 3 |
| `buildDayWindow` | 1 | 1 |
| `chooseVisibleDays` | ~10 (boundary table + cap) | 9 |
| `computeEventPlacement` | 8 | 8 |
| `layoutOverlaps` | 5 | 5 |
| `splitTimedEventByDay` | 3 | 3 |
| `getReferenceDate` | 4 | 4 |
| `isPastEvent` | 4 | 4 |
| `formatHourLabel` | 4 | 6 |
| **Total** | **≥30** | **53** |

---

## Build/lint/test results

```
$ npm test
 ✓ test/utils/grid.test.ts (53 tests) 31ms
 Test Files  1 passed (1)
      Tests  53 passed (53)

$ npm run lint
> eslint 'src/**/*.ts' 'test/**/*.ts' --fix --format stylish
(clean)

$ npm run build
> cross-env NODE_ENV=prod rollup -c
src/calendar-card-pro.ts → dist...
created dist in 4.7s

$ git diff --stat -- src/rendering/render.ts
(empty — Rule 5 invariant intact)

$ git diff --stat -- src/utils/events.ts
(empty — story 0-5 will add the optional arg)
```

---

## Decisions and deviations from the orchestrator brief

### 1. Used **relative imports** instead of the `@utils/*` path alias

**Brief said**: "Use the @utils/* path alias (verify in tsconfig.json:21)".

**Decision**: Used relative imports (`'../config/types'`, `'./events'`, `'./format'`).

**Justification**:
- Existing src/ does not use the `@utils/*` alias anywhere — `grep -rn "from '@" src/` returned only `@mdi/js` (an external package). All internal imports are relative.
- No `vitest.config.*` file exists; without `vite-tsconfig-paths` or an explicit `resolve.alias` entry, Vitest does not auto-resolve `tsconfig.json` paths. Tests using `@utils/grid` would fail to load.
- Adding a vitest config purely to support an alias the rest of the codebase doesn't use is a net negative: more surface area, no benefit. It also exceeds story 0-2 scope (story 0-1 explicitly deferred vitest config — worklog 0003 §"Decisions" #4).
- The story acceptance criteria do not actually mention the alias path style; they say "No imports from Lit, DOM, HA, or events.ts" (line 56). That constraint is satisfied: the only import from `events.ts` is the public `getTimeWindow` permitted by line 72.

### 2. `splitTimedEventByDay` emits **local-time ISO strings** without timezone suffix

The HA calendar API returns `dateTime` strings in the form `"2026-05-13T22:00:00"` (no `Z`, no offset) when the calendar is set to local time. Our segments mirror this format via `toLocalIso(d)` so downstream consumers do not get a mix of `"…T22:00:00"` and `"…T22:00:00.000Z"` representations. Tests assert exact string equality on this format.

### 3. `EventPlacement.heightPx` is clamped **before** applying `minHeightPx`

Story line 30 says "minHeight after clamping (don't expand outside grid)". Implementation:
```ts
const maxHeight = bandHeight - topPx;
const heightPx = Math.min(maxHeight, Math.max(rawHeight, minHeightPx));
```
A 5-minute event starting at the visible top gets `min(960, max(2.5, 24)) = 24` (clamped to minHeight, not expanded). A 5-minute event starting 1 minute before the band end gets `min(0.4, max(2.5, 24)) = 0.4` (clamped to band, minHeight ignored to avoid spilling). Test G-2.5b asserts the `minHeight=24` case.

### 4. `layoutOverlaps` uses a **single-pass** algorithm with deferred output

Sort by `startMin`, walk events, on cluster-end flush the cluster's lane assignments out with the cluster's final `laneCount`. This avoids a two-pass (first to find clusters then to assign lanes) at the cost of a small `flush()` helper. Tested against all five G-2.9 specs including unsorted input (G-2.9e) and transitive overlap with lane reuse (G-2.9d).

### 5. Test counts exceed the minimum

Story line 38 sets a minimum (~30 tests). Delivered 53. Extras are mostly boundary-table expansions for `chooseVisibleDays` (per spec G-3.1b's full table) and the formatHourLabel 11/PM and 23/PM edges (per spec G-hourLabel's full enumeration).

### 6. No imports from `events.ts` beyond the **public** `getTimeWindow`

Verified: `grep -n "from './events'" src/utils/grid.ts` returns one line — `import { getTimeWindow } from './events';`. Story line 56 forbids "imports from … `events.ts`" but line 72 permits "calls public `EventUtils.getTimeWindow`". The narrow surface is intentional and minimal.

---

## Open questions / follow-ups

- **`computeNowLineTop`, `computeBannerPlacement`, `hasDayChanged`, `computeCardSize`** are intentionally NOT delivered here — story 0-2 line 52 explicitly defers them to their consumer stories (story 2-2, 2-1, 2-3, 0-7).
- **`snapToWindow`** is not in story 0-2's acceptance criteria (line 22 list). It is implied by spec G-5.1/G-5.1b but those specs reference behavior tested at the renderer-host integration level (epic01 story 1-1). I did not add a `snapToWindow` helper here. If a future story needs it, it can either be added to `grid.ts` or composed at the call site from `startOfWeek` + `buildDayWindow`. Flagging this as a possible scope-clarification for the orchestrator.
- **No CI test job** — story 0-1 deferred this; not addressed here.

---

## Next: Story 0-3

Per epic00/README.md, story 0-3 introduces the `view: 'list' | 'time-grid'` config discriminator and the grid-specific config fields (`time_grid_*`). The pure helpers in `grid.ts` are now ready to be consumed by the renderer in story 0-4.
