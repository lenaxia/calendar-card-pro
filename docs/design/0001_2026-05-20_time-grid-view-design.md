# Worklog: Time-Grid View for calendar-card-pro (Issue #300)

## Summary

Forked `alexpfau/calendar-card-pro` to address [issue #300](https://github.com/alexpfau/calendar-card-pro/issues/300) — adding a time-grid (Google Calendar-style) view with responsive 1/3/7-day columns and navigation. **No production code has been written yet.** Effort to date: a thoroughly stress-tested design document.

## Branch & repo state

- **Repo**: `/home/mikekao/personal/calendar-card-pro` (forked to `lenaxia/calendar-card-pro`)
- **Branch**: `feature/time-grid-week-view` (based on `upstream/dev`, no commits yet)
- **Working tree**:
  - `docs/design/time-grid-view.md` — untracked design doc (~1500 lines, v13)
  - `package-lock.json` — modified by `npm install` from public registry; will revert before any commit

## What's been produced

### Design document (v13)

Located at `docs/design/time-grid-view.md`. **1496 lines.** Contains:

- **§1–2** Goals and explicit non-goals
- **§3** 33+ assumptions, each with verification status against actual source code (cited line numbers)
- **§4** 11 functional-requirement groups (FR-1 through FR-11), each with numbered, testable sub-requirements
- **§5** Configuration schema additions (11 new fields, all top-level scalars)
- **§6** Module design (~600 lines): new files (`utils/grid.ts`, `rendering/render-grid.ts`), modified files, full helper signatures, render markup, host wiring code, CSS additions
- **§7** Interaction table with existing config knobs (`days_to_show`, `tap_action`, `weather`, etc.)
- **§8** 40 acceptance specs in Given/When/Then format
- **§9** 25 risks with mitigations (most "eliminated by vN-Fx")
- **§10** Test plan (Vitest, ~30+ pure-helper tests)
- **§11** Open questions (all closed)
- **§12** 11-phase implementation roadmap
- **§13** Definition of done

### Key design decisions captured

| Area | Decision |
|---|---|
| View selector | New `view: 'list' \| 'time-grid'`, default `'list'` |
| Column responsiveness | `ResizeObserver` on host; thresholds default `<500px → 1`, `<900px → 3`, else `7`. `time_grid_max_days` cap. |
| Navigation | `<` `>` shift 1 day; `<<` `>>` shift N days; `Today` button. Single-step buttons hidden in 7-day mode (snaps to week boundary anyway). |
| Window alignment | 7-day = week-aligned; 1/3-day = rolling |
| Fetch window | New `time_grid_navigation_days` (default 28) decoupled from list-view's `days_to_show`. Plumbed via optional `effectiveDaysToShow?` arg to `fetchEventData`. |
| All-day events | Banner strip above grid; spans columns; `time_grid_allday_bg_opacity` (default 0.2) for visibility |
| Now line | Imperative DOM update (no full re-render) every 60s; midnight refresh triggers `requestUpdate()` |
| Slot height | Code constant `SLOT_HEIGHT_PX = 24` (NOT a CSS variable — avoids inconsistency with imperative now-line update) |
| Overlap layout | Cluster-based packing, sorted by start time, greedy lane assignment |
| Multi-day timed events | Custom `splitTimedEventByDay` (NOT existing `splitMultiDayEvent`, which converts middle days to all-day) |

### Review process

Conducted **12 self-review passes** (v1 → v13), each with the protocol: collect findings → adjudicate REAL/PARTIAL/NON-ISSUE → apply fixes.

**Cumulative review stats:**

| Pass | Total | REAL | PARTIAL | NON-ISSUE |
|---|---|---|---|---|
| 1→2 | 23 | ~16 | ~5 | ~2 |
| 2→3 | 18 | 16 | 1 | 1 |
| 3→4 | 13 | 10 | 3 | 0 |
| 4→5 | 8 | 6 | 0 | 2 |
| 5→6 | 5 | 4 | 0 | 1 |
| 6→7 | 11 | 8 | 1 | 2 |
| 7→8 | 8 | 4 | 3 | 1 |
| 8→9 | 10 | 5 | 4 | 1 |
| 9→10 | 10 | 6 | 4 | 0 |
| 10→11 | 8 | 3 | 5 | 0 |
| 11→12 | 7 | 3 | 3 | 1 |
| 12→13 | 7 | 1 | 1 | 5 |
| **Total** | **~128** | **~82 real bugs fixed** | ~30 | ~16 |

**Notable substantive bugs caught pre-implementation:**

- **v2-C1**: `time_grid_breakpoints` shallow-merge data loss → flattened to scalars
- **v2-C4**: Now-line spanning all columns instead of today → moved inside today day-column
- **v3-F1**: `.ccp-grid-body` had no layout — time-axis wouldn't align with columns
- **v3-F8**: Today button hardcoded to offset 0 (broken when `start_date` ≠ today)
- **v9-F3**: `hasConfigChanged` didn't detect view changes (would cause stale data on toggle)
- **v10-F2**: `daysBetween` using `Math.floor` was wrong across DST (would silently glitch banners twice/year)
- **v11-F5**: Host's `updateEvents` not updated to pass `effectiveDaysToShow` (would have shipped grid view with broken navigation)

Each of these would have been a user-reported bug if shipped.

### Verified against source code

- `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `rollup.config.mjs`
- `src/calendar-card-pro.ts` (lifecycle, render dispatch, `setConfig`, `updateEvents`)
- `src/utils/events.ts` (`fetchEventData`, `processEvents`, `groupEventsByDay`, `getTimeWindow`, `splitMultiDayEvent`)
- `src/utils/format.ts` (`parseAllDayDate`, `formatTime`, `time_24h` resolution)
- `src/config/config.ts` (`DEFAULT_CONFIG`, `hasConfigChanged`)
- `src/config/types.ts` (`Config` interface)
- `src/rendering/render.ts` (list-view path; not modified)
- `src/rendering/styles.ts` (CSS variables, `.content-container`)
- `src/rendering/editor.ts` (hand-rolled LitElement editor patterns)
- `src/translations/localize.ts` and `languages/en.json`
- HA developer docs (calendar API end-exclusive semantics, `getCardSize` masonry view, `getGridOptions` section view)
- CONTRIBUTING.md, docs/architecture.md, .github/workflows/ci.yml

### Build/lint baseline

`npm run lint` and `npm run build` both pass clean on the feature branch with no changes (verified before any work).

## What hasn't been done

- **No production code written.** Zero `.ts` files modified; zero new `.ts` files created.
- **No tests written.** Vitest scaffolding planned in Phase 1.
- **No commits made.** Branch is at `upstream/dev` HEAD.
- **No PR opened.**

## Files in design doc directory

```
docs/design/
└── time-grid-view.md   (1496 lines, v13)
```

## Implementation phasing (from §12 of design)

If/when implementation begins, the plan is 11 commits:

1. Test scaffolding (vitest)
2. Pure-helper tests (red)
3. Pure-helper implementation (`src/utils/grid.ts`) — tests turn green
4. Config + types (`Config`, `DEFAULT_CONFIG`, `hasConfigChanged`)
5. Render module (`src/rendering/render-grid.ts`)
6. Host wiring (ResizeObserver, navigation, now-line, midnight refresh, `getCardSize`, `effectiveDaysToShow` arg)
7. Fetch-window plumbing (`fetchEventData` optional arg)
8. Styles
9. Editor (view selector, conditional grid panel, helper-text hint)
10. Translations (`en.json` keys)
11. Docs (`architecture.md`, README section)

## State of convergence

Pass 12 found 7 issues, of which **5 were non-issues** (probing areas and confirming correctness). Pass 13 trending toward "diminishing returns" — paper review's marginal value has dropped from catching shipped-broken issues (early passes) to verifying minor wording (late passes).

The next-most-valuable activity is either:
1. **Start Phase 1 implementation** — TDD will surface a different class of issues
2. **Commit v13 design as a standalone artifact** for external review before coding

## Decisions taken (per stakeholder direction)

- Test-driven and spec-driven design before any implementation ✓
- Validate every assumption against source rather than memory ✓
- Avoid overengineering; right-size complexity ✓
- Match existing coding style (file headers, no `any`, snake_case config, etc.) ✓
- Stakeholder-confirmed configuration choices (per earlier conversation):
  - Keep `time_grid_max_days` as a hard cap
  - Defer all-day banner overflow chip to follow-up
  - Add `time_grid_navigation_days` (default 28) decoupled from `days_to_show`

## Repo links

- Issue: <https://github.com/alexpfau/calendar-card-pro/issues/300>
- Related issues addressed in design: #14 (Column View), #239 (Monthly view), #282 (All-day banners), #296 (start-of-week alignment), #325 (live "now" line)
- Fork: <https://github.com/lenaxia/calendar-card-pro>
