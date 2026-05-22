# Worklog 0002 — Epics, Stories, and Six Revalidation Passes

**Date range**: 2026-05-20 — 2026-05-22
**Previous worklog**: [0001 — design phase](0001_2026-05-20_time-grid-view-design.md)
**Branch**: `feature/time-grid-week-view`
**Issue**: [alexpfau/calendar-card-pro#300](https://github.com/alexpfau/calendar-card-pro/issues/300)

---

## Goal

Break the [time-grid view design](time-grid-view.md) (v13, ~1500 lines) into agile epics and user stories at "new college grad" implementability level, then revalidate the breakdown until convergence.

## What was done

### Phase 1: initial epic + story breakdown

Per AGENTS.md Rule 0 ("MANDATORY WORK LOGS") and AGENTS.md Rule 1 ("STATE ASSUMPTIONS UP FRONT, THEN VALIDATE THEM"), I:

1. Validated the existing design doc was sound (already 12 review passes, 1500 lines, 40 specs)
2. Asked stakeholder for epic granularity, story file naming, and detail level — got: multiple epics by feature area, zero-indexed (`storyN-M.md`), standard user-story template
3. Split issue #300 into 4 epics with 17 stories total:
   - **epic00** (7 stories): time-grid base view
   - **epic01** (4 stories): responsive columns + navigation
   - **epic02** (3 stories): all-day banners + now-line
   - **epic03** (3 stories): editor + localization + documentation
4. Each epic README has scope, out-of-scope, dependencies, FR mapping, story table
5. Each story has user-story format (As a / I want / So that), acceptance criteria with checkboxes, technical notes citing source line numbers + design-doc review findings, files touched, definition of done, mapping to design doc + AGENTS.md rules
6. Created top-level `docs/epics/README.md` indexing all epics

Initial commit: `161e4b6` — "docs: add epics and user stories for time-grid view"

### Phase 2: six revalidation passes

Following the pattern from the original design doc (12 passes, 128 findings), applied the same protocol to the epics/stories. Each pass:

1. **State assumptions** about source code, file structure, library behavior
2. **Validate each assumption** by reading source directly (not memory)
3. **Probe areas not deeply checked** in previous passes
4. **List findings** without filtering
5. **Adjudicate** each as REAL / PARTIAL / NON-ISSUE with cited evidence
6. **Apply fixes** — only REAL items; PARTIAL deferred or polished; NON-ISSUE explicitly marked

Six passes total. Cumulative results:

| Pass | Total findings | REAL bugs | PARTIAL | NON-ISSUE | Files modified | Lines changed | Commit |
|---|---|---|---|---|---|---|---|
| 1 | 26 | 12 | 8 | 6 | 7 | +93 / -42 | `673ca78` |
| 2 | 13 | 6 | 4 | 3 | 7 | +62 / -22 | `1b699b2` |
| 3 | 7 | 5 | 1 | 1 | 5 | +67 / -67 | `d4c4c67` |
| 4 | 9 | 5 | 2 | 2 | 4 | +45 / -17 | `6852a58` |
| 5 | 7 | 3 | 3 | 1 | 3 | +27 / -9 | `177ec0f` |
| 6 | 10 | 4 | 4 | 2 | 6 | +33 / -6 | `4884250` |
| **Total** | **72** | **35** | **22** | **15** | — | — | — |

**35 real bugs caught across 6 passes.**

### Most consequential bugs caught (would have shipped broken)

| # | Pass | Bug | Impact |
|---|---|---|---|
| C-1 | 1 | nested-object Config field would lose defaults via shallow merge in `setConfig` | Editor users save once → defaults gone on next load |
| F-5 | 1 | `addSelectField` numeric values rejected by TS | story3-1 wouldn't compile |
| F-7 | 1 | Vitest scaffold missing tsconfig + eslint glob updates | story0-1 tests would fail to discover |
| F-8 | 1 | story0-4 didn't call `snapToWindow` from epic00 — epic01 would have to modify the renderer | Cleaner separation; one less story-edit-after-merge |
| F-13 | 1 | `splitTimedEventByDay` metadata preservation unspecified | Lost `_entityId`, accent colors broken |
| D-1 | 2 | List-view editor sections wrap as units (h3 + helper-text + fields), not individual fields | Orphan h3 headers in editor when toggling to grid |
| D-4 | 2 | `getEntityAccentColorWithOpacity` called without `event` 4th arg | Lost `_matchedConfig` fast-path, slower lookups |
| D-7 | 2 | `time_grid_allday_max_height` was a phantom config field with no implementation | YAML option that did nothing |
| D-9 | 2 | AGENTS.md had 3 stale `:482` line refs (actual: `:478`) | Wrong-line citations propagate confusion |
| E-3 | 3 | `getCardSize` returning `3` for list view changes existing list-view masonry behavior | Scope creep, violates AGENTS.md Rule 5 |
| E-4 | 3 | `_onResize` reading from closure entries — fragile if ResizeObserver fires twice in one frame | Stale layout values in some scenarios |
| E-7 | 3 | Story3-3 proposed duplicate config-options table in README | Doc-maintenance burden |
| **G-1** | 4 | **`new ResizeObserver(this._onResize)` loses `this` context** | **Runtime crash on first observer event** |
| G-2 | 4 | `getCardSize` returning `undefined` is non-idiomatic | Worked but confused implementers |
| G-3 | 4 | Story0-4 contradicted itself on week-alignment | Confusing intent |
| G-9 | 4 | `getCardSize` couldn't be unit-tested from `test/utils/grid.test.ts` (host method) | Test plan uncompilable |
| I-2 | 5 | Story0-7 missing dep on story0-2 (`SLOT_HEIGHT_PX`, `utils/grid.ts`) | Compile error if implementer follows dep chain |
| I-7 | 5 | `computeCardSize` duplicated in story0-2 + story0-7 (pass 4 over-fix) | Confusion: do I add tests now or later? |
| K-1, K-9 | 6 | Two stale `time_grid_allday_max_height` references after pass 2 D-7 removal | Implementer confusion about field existence |
| K-10 | 6 | Bare `formatHourLabel(...)` should be `Grid.formatHourLabel(...)` | Namespace inconsistency |

**Highest-impact**: G-1 — the ResizeObserver `this`-binding bug would have caused a runtime crash on the first resize event (TypeError: cannot read property 'X' of undefined). Paper review caught it before any code was written; subsequently added to AGENTS.md "Common Mistakes" so all future agents avoid it.

### Files & artifacts produced

```
docs/epics/
├── README.md                      82 lines — top-level index
├── epic00/
│   ├── README.md                  119 lines — base view epic
│   ├── story0-1.md                Vitest scaffolding
│   ├── story0-2.md                Pure helpers (TDD)
│   ├── story0-3.md                Config schema
│   ├── story0-4.md                Renderer module (largest story)
│   ├── story0-5.md                Render dispatch + host wiring
│   ├── story0-6.md                CSS
│   └── story0-7.md                getCardSize
├── epic01/
│   ├── README.md                  Responsive + navigation
│   ├── story1-1.md                ResizeObserver
│   ├── story1-2.md                Navigation handlers
│   ├── story1-3.md                Window alignment
│   └── story1-4.md                Fetch-window decoupling
├── epic02/
│   ├── README.md                  All-day banners + now-line
│   ├── story2-1.md                Banner placement
│   ├── story2-2.md                Now-line rendering
│   └── story2-3.md                Midnight refresh
└── epic03/
    ├── README.md                  Editor + i18n + docs
    ├── story3-1.md                Editor view selector + panel
    ├── story3-2.md                English translations
    └── story3-3.md                README + architecture.md updates

Total: 4 epic READMEs + 17 story files + 1 index = 22 files, ~3092 lines
```

Plus AGENTS.md updates (across passes 2 and 5):
- Pass 2 D-9: Fixed 3 stale `:482` line references → `:478`
- Pass 2 D-9: Fixed `src/utils/actions.ts` → `src/interaction/actions.ts`
- Pass 5 I-5: Added "Common Mistake #5: ResizeObserver `this`-binding" with FORBIDDEN/CORRECT examples; renumbered 5-10 → 6-11

## What was verified

For all 35 real bugs and 22 partial fixes:
- **Source citations**: every line number cited (e.g., `setConfig at :478`, `editor.ts:687`) was verified by `sed -n` or `grep -n`
- **API signatures**: `addSelectField`, `addTextField`, `addBooleanField`, `addExpansionPanel`, `getEntityAccentColorWithOpacity`, `parseAllDayDate`, `getFirstDayOfWeek`, etc. — all read directly from source
- **HA contracts**: `getCardSize` semantics verified against developers.home-assistant.io docs
- **TypeScript constraints**: `Pick<Config, ...>` runtime behavior, `nothing` return-type compatibility, ResizeObserver callback signature
- **Cross-story consistency**: each helper introduced (e.g., `splitTimedEventByDay`, `daysBetween`, `formatHourLabel`, `computeCardSize`, `computeBannerPlacement`, `computeNowLineTop`, `hasDayChanged`, `clampOffset`) was traced from definition to all consumer stories

## What was NOT done

- **No production code written.** All 8 commits are docs-only.
- **No tests written.** Vitest scaffolding planned in epic00 story0-1.
- **No PR opened.** Branch is doc-only at this point; PR comes after epic03 ships.

## Build / lint / test results

- `npm run lint` — not run (no source changes)
- `npm run build` — not run
- `npm test` — N/A (Vitest not added yet, planned in story0-1)

## Convergence analysis

**Real bug rate per pass:**
12 → 6 → 5 → 5 → 3 → 4

**Total findings per pass:**
26 → 13 → 7 → 9 → 7 → 10

**Pattern observed**: real bugs decline from 12 to ~3-5 per pass. Each pass that probes unprobed areas finds 3-5 new substantive issues. The asymptote is **not zero** — paper review has a floor below which only implementation surfaces issues (TDD-driven discoveries, runtime errors, integration bugs).

**Diminishing returns kick in around pass 5-6**: more findings are PARTIAL (cosmetic) or NON-ISSUE (verifying that already-correct things are correct). But every pass still finds genuine bugs that would have caused implementer pain — even pass 6 caught the RTL `border-left` issue and stale field references.

## Open questions / follow-ups

None. The stories should be implementable as-is. The next action is starting **epic00 story0-1** (Vitest scaffolding).

## Branch state

```
b69a30b Merge pull request #332 from alexpfau/dev   ← upstream/dev HEAD
13d7910 docs: add time-grid view design and AGENTS.md
161e4b6 docs: add epics and user stories
673ca78 docs: revalidate epics/stories — pass 1 (12 real fixes)
1b699b2 docs: second revalidation pass — pass 2 (6 real fixes)
d4c4c67 docs: third revalidation pass — pass 3 (5 real fixes)
6852a58 docs: fourth revalidation pass — pass 4 (5 real fixes)
177ec0f docs: fifth revalidation pass — pass 5 (3 real fixes)
4884250 docs: sixth revalidation pass — pass 6 (4 real fixes)   ← current HEAD
```

8 commits ahead of `upstream/dev`. Pushed to `origin/feature/time-grid-week-view`. Working tree clean.

## Cumulative stats

- **Design doc revisions**: 13 versions (worklog 0001 captures the design phase)
- **Story file revisions**: 6 revalidation passes
- **Real bugs caught pre-implementation across all reviews**: 82 (design phase) + 35 (story phase) = **117**
- **Lines of design + epic + story documentation**: ~4600 lines total
- **Lines of production code**: 0

The discipline of "state assumptions, validate, then write" — and re-running it 6 times for stories on top of 12 times for the design — caught 117 real bugs that would have otherwise reached `dev` branch.
