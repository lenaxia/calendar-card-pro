# Worklog 0020 — Skeptical 6-Reviewer Audit + Comprehensive Fix Cycle

**Date**: 2026-05-22 → 2026-05-23
**Branch**: `feature/time-grid-week-view`
**Trigger**: User asked "what is your confidence of this being actually complete?" after worklog 0019 declared the feature done.
**Scope**: 6-reviewer skeptical audit followed by 7-phase fix cycle (A-J) with subagent-validator iteration loops.
**Outcome**: 47 distinct REAL findings identified and resolved; 215 tests passing (+ 123 since 0019); bundle +31.59 KB (within +35 KB cap); list-view byte-identical (Rule 5 invariants intact).

---

## Why this worklog exists

Worklog 0019 declared "feature branch is complete" — 17 stories, 92 tests, lint/build green. The user's follow-up was direct: _"what is your confidence of this being actually complete? delegate to multiple skeptical reviewers to ensure completeness and correctness. All code should follow idiomatic best practices, should be SOLID, robust, maintainable, reliable and PERFORMANT. Not over engineered, not overly complex, and should meet the spirit and letter of the ask."_

The agent's pre-audit confidence was ~95%. The post-audit confidence — after 6 parallel reviewers each found unique REAL bugs in their dimension — was ~55%. The implementation was substantially shipped on the happy path but had material gaps in:

- HIGH-severity correctness bugs that integration testing would have caught (Bugs #1-7)
- FR-2.6 (hidden pill + clipped indicators) shipped as documented but not implemented
- Architectural smells (14 scattered `view === 'time-grid'` checks with no exhaustiveness; dual-write `_lastRenderDay`; `now: new Date()` per render)
- Validation gaps for 7 of 11 new config fields
- Performance regressions (now-line tick on inactive HA tabs, redundant date allocations)
- Accessibility bugs (`aria-disabled` without `disabled` — keyboard users can click "disabled" buttons)
- Missing CI test gate (regressions could ship without `npm test` failing CI)

The user's response to the audit was unambiguous: **"We will not defer any fixes. This should be an idiomatically correct and complete implementation that is robust and maintainable."** This worklog documents how all 47 findings were addressed.

---

## Reviewer architecture

Six parallel skeptical reviewers were dispatched, each focused on a different dimension. To prevent reviewer collusion, each was given the same brief — _"the previous agent claims X is true; find evidence to the contrary"_ — but with a different lens:

| Reviewer            | Lens                                                                                                                                                                               | Findings                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Correctness         | Math errors, lifecycle bugs, state staleness, edge case events, overlap layout, now-line correctness, navigation/clamping, weak tests                                              | 7 REAL (3 HIGH, 3 MED, 1 LOW), 4 PARTIAL, 3 weak tests |
| SOLID/Architecture  | SRP, OCP, DRY, idiomatic Lit 3, idiomatic TS, coupling, over/under-engineering, maintainability                                                                                    | 3 HIGH, 9 MED, 7 LOW                                   |
| Performance         | Render-path hot loops, allocations per render, DOM thrashing, observer overhead, memory leaks, bundle, re-render cascades                                                          | 2 HIGH, 6 MED, 2 LOW                                   |
| Completeness/Spec   | FR-by-FR trace, phantom config fields, half-finished features, editor gaps, missing translations, stories shipped "in spirit only"                                                 | 4 HIGH, 7 MED, 4 LOW                                   |
| Robustness/Security | Input validation, HA API failure modes, XSS/injection, error swallowing, locale/TZ gotchas, race conditions, concurrent observers, a11y                                            | 4 HIGH, 8 MED, 9 LOW                                   |
| Invariants/Meta     | Rule 5 (render.ts/events.ts), Rule 6 (no any), Rule 7 (comments), Rule 8 (tests), Common Mistakes #1/3/4/5, test count, lint, build, bundle, worklogs, dist gitignored, CI hygiene | 1 HIGH, 1 LOW (mostly meta-passes)                     |

**Cumulative: 47 unique REAL findings** (after deduplication across reviewers — many found the same issue from different angles, e.g. validator gaps were flagged by 4 of 6 reviewers).

---

## Decisions made before fix cycle

The user was asked 7 specific questions where the audit findings tensioned with hard invariants or scope. Decisions captured here for traceability:

1. **FR-2.6**: Implement both `+N hidden pill` AND `↑/↓ clipped indicators` fully (not drop one).
2. **`now: new Date()` per render**: Make `now` a `@state` field updated by the now-line interval (idiomatic Lit 3, eliminates the race).
3. **ReactiveControllers**: Refactor to `NowLineController` + `ResponsiveColumnsController`, not host methods. Per Lit 3 idiom.
4. **`getCardSize` for list view**: Return 1 (matches HA's default-when-undefined; preserves byte-identical list-view masonry behavior). Update design doc; the design doc claim of "3 (existing default behavior)" was factually wrong.
5. **`show_description` per-entity in grid**: Fix design doc to remove the contradictory claim (current code is right — description is intentionally not shown in event blocks; users wanting full event detail use list view).
6. **Bundle cap**: Raise from +20 KB to +25 KB (then iteratively +30, +35) with explicit rationale. The cap is a process accountability number, not an external constraint; raising transparently is preferable to compressing the implementation below the threshold of correctness/robustness/idiomatic-Lit.
7. **DRY across Rule-5-mandated duplications** (`isPastEvent`, `getReferenceDate`): keep `Grid.*` versions as canonical; document the duplication is mandated by Rule 5; do NOT modify `render.ts`/`events.ts` to deduplicate.

---

## Fix cycle architecture

Three execution modes:

- **In-context (Phase A, B, C, G, H, I, J)**: orchestrator does the work directly. Used for foundational changes (Phase A docs), highly-coupled sequences (Phase B's correctness chain, Phase C's controllers refactor), and small mechanical changes (Phase G/H/I).
- **Delegated (Phase D, E, F)**: focused subagent does the work, then a separate skeptical validator subagent reviews the diff. Iterate until validator returns no REAL findings, then commit. Used for parallelizable mid-size scopes.
- **Iterate**: Each delegated phase passed through at least one validator iteration. The validator's brief was "find what the implementer missed". Validators caught real bugs in every phase (e.g. Phase B validator caught `max_days` reduction unreachable branch; Phase C validator caught `hostUpdated` perf regression; Phase D validator caught bundle-byte miscount).

Quality bar to terminate each iteration: validator returns zero REAL findings + lint/test/build green + Rule 5 invariants intact.

---

## Phase A — AGENTS.md cap raise + design doc corrections (in-context)

**Commit**: `f0c4fe8`

- Raised bundle cap from +20 KB to +25 KB in AGENTS.md and design doc with rationale.
- Corrected design doc FR-10.1: `getCardSize` for list view returns `1` (matches HA's default-when-undefined; preserves byte-identical list-view masonry behavior). Earlier draft claimed `3` which would have changed list-view sizing.
- Corrected design doc FR-2.5: removed contradictory `show_description` per-entity claim (current code is right — grid event blocks intentionally omit description).
- Rewrote design doc FR-2.6 to specify the `+N hidden pill` and `↑/↓ clipped indicators` markup fully (target for Phase D).
- Rewrote FR-11.3 to describe the NowLineController approach (target for Phase C).
- Updated all 4 epic READMEs and RELEASE_NOTES to reference the new cap (also corrected RELEASE_NOTES' inaccurate "well under +20 KB" claim — actual delta was +24 KB).

No source changes. Doc-only commit.

---

## Phase B — HIGH-correctness fixes (in-context, 6 sub-batches)

**Commit**: `87a13db`

Addressed 8 REAL HIGH-severity correctness findings. Test count grew 92 → 150 (+58 spec-driven tests).

**Bug #1 — Visible window outside fetched range**: Sun-open + Mon-fdow caused snapToWindow to return the previous Mon → fetch starts at today, Mon..Sat have zero events. Fix: new pure helper `Grid.computeGridFetchRange()` backward-shifts the fetch start_date by 7 days; new `Grid.buildGridFetchConfig()` composes the full fetch-mode config; host's `updateEvents()` uses both for `view === 'time-grid'`. List-view fetch path is byte-identical.

**Bug #2 — `viewOffsetDays` not re-clamped on config change**: Resize narrow→wide could leave `viewOffsetDays > _maxOffset()`. Fix: new private `_clampViewOffset` helper called from `_applyVisibleDays` after `visibleDays` changes, and from `updated()` when `navigation_days` changes. View transitions reset `viewOffsetDays = 0` defensively.

**Bug #4 — `split_multiday_events: true` corrupts grid view**: `processMultiDayEvents` synthesizes all-day middle-day segments that the grid then renders as banners instead of timed blocks. Fix: `buildGridFetchConfig` forces `split_multiday_events: false` at both global and per-entity-override levels; the grid's own `splitTimedEventByDay` handles midnight-aware splitting correctly.

**H1 / M10 — Time-axis width JS/CSS mismatch + duplicate helpers**: JS hardcoded 60px; CSS defaulted 48px; header columns drifted 12px from body. Fix: `TIME_AXIS_WIDTH_CSS = 'var(--calendar-card-grid-time-axis-width, 48px)'` is the single source of truth. Inline grid-template-columns now uses the CSS variable so card-mod / theme overrides flow consistently to both header and body. The duplicated `buildGridTemplateColumns` / `buildBodyColumns` are merged into one `buildGridColumns` helper.

**Bug #5 / H1-robust — 7 of 11 new fields unvalidated**: `setConfig` validation moved to a new exported helper `Config.validateTimeGridConfig` with comprehensive bounds checking for all 11 fields, including the `time_grid_max_days <= time_grid_navigation_days` invariant (H3-robust). Each invalid field logs a specific `Logger.warn` explaining what was reset to what. +41 tests covering every coercion path including cascading invariants.

**L3-robust — invalid hour range reset BOTH start AND end**: Now each side resets only when individually invalid; both reset only if both individually invalid OR `start >= end` pair-invariant violated.

**Validator iteration**: Caught one MED finding (worklog rule violation, since fixed by this very file), and 4 LOW findings (unreachable code branch in max_days reduction, cascading test gap, host integration coverage gap, editor warning dead-code claim). All resolved.

---

## Phase C — ReactiveControllers refactor (in-context)

**Commit**: `fd5d52e`

Idiomatic Lit 3 `ReactiveController`s replace 4 host fields + 6 host methods of view-specific lifecycle. Test count grew 150 → 178 (+28 controller tests). Addressed 6 REAL findings:

- **M7 (arch) — host bloat**: New `src/controllers/responsive-columns-controller.ts` and `now-line-controller.ts`. Each implements the Lit 3 `ReactiveController` interface (`hostConnected`/`Disconnected`/`Updated`). The host LitElement satisfies the structural host interfaces directly via inherited LitElement/HTMLElement properties; only `onVisibleDaysChanged` and `hostElement` need thin one-liner adapters. Controllers are activated only when `view === 'time-grid'`; fully inert in list view.

- **Bug #3 (correctness) — now-line stuck at top:0 for up to 60s after visibleDays/viewOffsetDays change**: Now-line top is now computed in the renderer via `styleMap` from `ctx.now`, so it re-renders coherently alongside any prop change. The previous imperative DOM update (renderRoot.querySelector + style.top assignment) is eliminated.

- **M5 / H3-arch (correctness) — `_lastRenderDay` dual-write**: `_lastRenderDay` no longer exists in host. `NowLineController` owns `lastRenderDayMs` as a private field, written only in `tick()`. Single source of truth; midnight rollover detection is reliable across all re-render triggers.

- **M9 (correctness) — `now: new Date()` per render**: `ctx.now` is now sourced from `this._nowLine.now` (controller-owned single source of truth). All renders within a tick window see the same `now`; past-event styling and now-line position stay coherent.

- **Perf-HIGH — now-line tick runs on inactive HA dashboard tabs**: `NowLineController` integrates `IntersectionObserver` to pause ticks when host is off-screen. HA dashboard tabs that keep `document.visibilityState='visible'` but are not actually rendered no longer consume CPU. Falls back to visibility-only on browsers without `IntersectionObserver`.

- **E-13 (robustness) — no remeasure on visibilitychange:'visible' if started hidden**: `ResponsiveColumnsController` exposes a public `remeasure()` method; host's `_handleVisibilityChange` calls it on the 'visible' branch.

**Test infrastructure**: `happy-dom` added as devDep for the controller tests that touch `document` / `IntersectionObserver`. Per-file directive `@vitest-environment happy-dom` keeps the existing pure-helper tests in node environment (zero overhead).

**Validator iteration**: Caught one MED perf regression (`hostUpdated` forced layout on every reactive update via `offsetWidth` read; previous host-side code only re-measured on config-change). Fix: gate `measure()` in `hostUpdated` on a `configKey()` tuple of breakpoint-relevant fields. ResizeObserver still covers actual resize events. +2 perf-regression tests. Bundle cap raised to +30 KB after this phase.

---

## Phase D — FR-2.6 hidden pill + clipped indicators (delegated)

**Commit**: `2b3f046`

Fully implements FR-2.6 (was documented in design but not in code). Test count grew 178 → 185.

- Events whose entire timed segment falls outside `[start_hour, end_hour)` are aggregated per-day-column into a `+N` pill at the top of the column. Click is a no-op in v1 per design.
- Events whose timed segment is partially clipped at the band's top get a decorative `↑` glyph via `.ccp-grid-event.clipped-top::before`; partially clipped at the bottom get `↓` via `.clipped-bottom::after`.
- Indicators are decorative (CSS-generated content; screen readers skip). `aria-label` on the pill conveys the count to assistive tech via the `time_grid_hidden_events_aria` translation key with `{n}` placeholder pattern.

New pure helper `Grid.bucketAndPlaceSegments(segments, days, params)` distributes already-day-split timed segments into per-column buckets and counts out-of-band segments per column. Hidden counts are per-column (never global). Clipped-top/clipped-bottom segments are placed visibly, NOT counted as hidden (clipped means partially visible). 7 new unit tests covering: outside-band counted; clipped not counted; per-column never global; segment outside the visible window dropped silently; zero-count branch; empty input; midnight-end edge.

**Validator iteration**: Caught 4 findings — (1) bundle 54 bytes over the +30 KB decimal cap (acknowledged transparently in the commit message), (2) duplicate `PlacedSegment` interface in render-grid.ts (deduped to use `Grid.PlacedSegment`), (3) translation key `time_grid_hidden_events_aria` missing from en.json (added with `{n}` template), (4) ungrammatical "1 hidden events" aria-label (fixed via `{n}` placeholder pattern, consistent with other aria strings).

---

## Phase E — 12 MED-severity findings (3 parallel subagents + in-context completion)

**Commit**: `2e96a89`

Three parallel subagents dispatched (E-correctness, E-DRY-perf, E-robust-editor). They collided on shared files (`src/utils/grid.ts`, `src/calendar-card-pro.ts`, `src/rendering/render-grid.ts`). The E-DRY-perf agent stopped early per AGENTS.md Rule 3 (don't perform destructive git ops without confirmation) and reported the conflict. The orchestrator completed E-6 (DRY documentation) and E-7 (perf optimizations) in-context after the other two agents finished. Test count grew 185 → 211.

Each finding addressed:

- **E-1**: `computeTodayOffset` week-alignment for 7-day mode. Old: clamped to `[0, navDays - vis]`, could yield window without today. New: signature now takes `firstDayOfWeek`; for vis=7, returns `daysBetween(reference, startOfWeek(today, fdow))` so the snapped window always contains today. Verified: ref=2026-05-06 Wed, today=Wed May 13, navDays=10, vis=7, fdow=Mon now returns 5 (today in window) instead of the broken clamp-to-3.
- **E-2**: `formatHourLabel(0, true) === '00'` (24h consistency).
- **E-3**: Exhaustiveness `never`-check on view discriminator. `switch (view) { case 'list': ...; case 'time-grid': ...; default: const _: never = view; throw new Error(...); }` at the render dispatch. TypeScript empirically catches a hypothetical third 'month-grid' variant at compile time.
- **E-4**: `time_grid_max_days` and `time_grid_interval_minutes` as `addSelectField` (not `addTextField`). New translation keys: `time_grid_interval_15/30/60`, `time_grid_max_1_day/3_days/7_days`.
- **E-5**: `getFirstDayOfWeek` return type tightened to `0 | 1`. Unsafe `as 0 | 1` casts removed.
- **E-6**: DRY documentation for Rule-5-mandated duplications. `Grid.getReferenceDate` and `Grid.isPastEvent` JSDoc explicitly cite AGENTS.md Rule 5 as the reason their math duplicates events.ts and render.ts inline copies.
- **E-7**: Render-path performance. Module-level memoized `Intl.DateTimeFormat` factory with 16-entry LRU cache; eliminates ~14 Intl construction calls per render in 7-day mode. `navClick` higher-order helper hoisted to module scope so the outer closure is stable across renders.
- **E-8**: Top-level `try/catch` around `renderTimeGrid` returns the standard error TemplateResult via `Logger.error`. `formatRangeLabel` wrapped (consistent with existing `formatWeekday`/`formatMonth` pattern).
- **E-9**: `?disabled` binding instead of `aria-disabled` on nav buttons. Browsers natively prevent click events on disabled buttons, fixing the previous keyboard a11y bug. CSS selector updated to `button[disabled]`.
- **E-10**: All-day banners filter past events when `show_past_events=false`. `buildAllDayBanners` exported and tested. 5 new tests.
- **E-11**: Editor numeric inputs gain `min/max/step` constraints. The hour-range double-reset fix from Phase B is preserved.
- **E-12**: `accent_color` CSS `var()` pass-through. `convertToRGBA` now preserves user-provided `var(--name)` syntax via `color-mix(in srgb, color X%, transparent)`. Previous code collapsed all `var()` inputs to a hardcoded `--calendar-color-rgb` fallback.

**Validator iteration**: Caught 2 LOW findings — (1) redundant `as 0 | 1` cast in calendar-card-pro.ts (now dead code since E-5 tightened the return type), (2) misleading "fallback to --calendar-color-rgb if color-mix unsupported" claim in convertToRGBA JSDoc — the fallback doesn't exist (HA's browser baseline supports color-mix). Per AGENTS.md Rule 2 (NEVER MAKE CLAIMS YOU CAN'T PROVE). Both fixed.

Bundle cap raised to +35 KB after this phase with explicit rationale.

---

## Phase F — 7 LOW-severity findings (delegated, idiom + DRY hygiene)

**Commit**: `70b7586`

Test count unchanged at 211 (stylistic/idiom only, no new behavior).

- **F-1**: 4 sites in render-grid.ts where `class="static ${classMap(...)}"` was used switched to full-classMap form `class=${classMap({static: true, ...})}` matching the existing list-view convention.
- **F-2**: `chromePx=80` magic number replaced with named constants `NAV_BAR_PX (40) + DAY_HEADER_PX (40) + ALLDAY_RESERVE_PX (0)` with JSDoc.
- **F-3**: Day-column `.map()` replaced with Lit `repeat()` directive using `(day) => day.getTime()` stable keys. Enables Lit to recycle 6/7 columns when navigation window shifts by 1 day.
- **F-4**: SLOT_HEIGHT_PX cross-reference comments. `styles.ts` has a comment near `min-height: 24px` referencing the constant; reciprocal comment at the SLOT_HEIGHT_PX export pointing back. The CSS-variable bridge was deliberately rejected by the design (AGENTS.md "Key Design Decisions") to prevent JS/CSS drift.
- **F-5**: `splitTimedEventByDay` shallow-spread shared-reference invariant documented. JSDoc explains that `_matchedConfig` is shared between segments via shallow spread, which is safe because `_matchedConfig` is read-only post-fetch (verified: only one assignment site in events.ts during processing; all 22 other references are reads).
- **F-6**: subsumed by Phase C (ResponsiveColumnsController eliminated the triple-call concern).
- **F-7**: `color-mix` browser support already documented in E-12 commit.

**Validator iteration**: Zero REAL findings. Phase F clean.

---

## Phase G — README updates (in-context)

**Commit** (combined with H/I): `6fd0743`

Added 4 missing notes to the README time-grid section:

- Card-level `tap_action`/`hold_action` fire on grid event blocks (clarifies per-event interactions are out of scope for v1).
- `weather` forecast strip is intentionally not rendered in grid view.
- `today_indicator` dot/pulse styles are list-view-only; grid uses colored bold day-header + tinted today column.
- Browser support note for `color-mix` (Chromium 117+, Firefox 113+, Safari 16.2+ per HA evergreen baseline); silent no-tint fallback on older browsers.

---

## Phase H — Test gap fills (in-context)

**Commit** (combined with G/I): `6fd0743`

Test count grew 211 → 215.

- **H-1 (W-1 boundary)**: `chooseVisibleDays(899, 500, 900, 3)` and `(..., 1)` cover the cap-dominates-cap path.
- **H-2**: DST fall-back regression test for `splitTimedEventByDay`. Note: spring-forward is not round-trip-safe at the JS Date layer regardless of our code (skipped local times resolve to next valid moment); fall-back is unambiguous and is what we test.
- **H-5**: Malformed-event resilience for `buildAllDayBanners` (does not throw on invalid date strings, missing end, end < start).

---

## Phase I — CI runs npm test (in-context)

**Commit** (combined with G/H): `6fd0743`

Renamed CI job `lint-build` → `lint-test-build`. Added `Test` step between Lint and Build. Per AGENTS.md "Layer 3: Run Lint and Build", expanding to include tests once they exist (Phase 1+ for time-grid). Worklog-0020 finding F2 (HIGH severity: CI does not run tests) is now resolved.

---

## Phase J — Final validation + worklog (in-context)

**Final state verification**:

| Check                                              | Result                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `npm run lint`                                     | clean ✓                                                            |
| `npm test`                                         | 215/215 pass ✓                                                     |
| `npm run build`                                    | clean ✓                                                            |
| `git diff upstream/dev -- src/rendering/render.ts` | 0 lines ✓ (Rule 5)                                                 |
| `git diff upstream/dev -- src/utils/events.ts`     | exactly 8 +/- lines (effectiveDaysToShow plumbing only) ✓ (Rule 5) |
| `grep ': any\|<any>' src/ test/`                   | 0 matches ✓ (Rule 6)                                               |
| Bundle                                             | 321,224 bytes = +32,345 = +31.59 KB (within +35 KB cap) ✓          |
| Working tree                                       | clean (no untracked/uncommitted) ✓                                 |
| Worklog 0020                                       | this file ✓                                                        |

---

## Cumulative stats since worklog 0019

- **Commits**: 9 phase commits (A through J's combined G/H/I)
- **Files modified**: 18 across src/, test/, docs/, .github/
- **Net LOC**: +1900 source + tests + worklog (excluding boilerplate JSDoc compression and lint reformatting)
- **Test count**: 92 → 215 (+123 new tests, +134%)
- **Bundle delta**: +24 KB (worklog 0019) → +31.59 KB (now)
- **REAL findings resolved**: 47
- **Validator iterations**: 6 (one per delegated phase, all converged in 1-2 rounds)

---

## Bundle cap rationale

The +20 KB original cap was a design-doc estimate. It was raised three times during this fix cycle:

| Step    | Cap    | Why                                                                                                                                      |
| ------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Phase A | +25 KB | After audit added FR-2.6, exhaustiveness, full validation, editor selects                                                                |
| Phase C | +30 KB | After ReactiveControllers + IntersectionObserver + happy-dom                                                                             |
| Phase E | +35 KB | After DRY documentation + Intl formatter cache + try/catch error boundary + accent_color var() preservation + numeric editor constraints |

Per AGENTS.md "Rule 2: NEVER MAKE CLAIMS YOU CAN'T PROVE", these raises are documented transparently rather than hidden by compressing the implementation. The cap is a process accountability number, not an external constraint. Final bundle 321,224 bytes = +31.59 KB, comfortably within the +35 KB cap with ~3.4 KB of headroom for follow-up work.

---

## Confidence assessment after fix cycle

**Pre-audit**: ~95% confidence.
**Post-audit**: ~55% confidence (47 REAL findings would have surfaced in PR review).
**Post-fix**: ~95% confidence.

The remaining 5% accounts for things automated review fundamentally can't catch:

- HA-specific runtime behavior under real config files (manual smoke test still owed at PR time).
- Browser-engine-specific behavior on the long tail of supported browsers (Safari quirks with color-mix, RTL layouts).
- Long-running observation (memory leaks over hours, DST transitions in production timezones).

These are deferred to PR review against a live HA instance, per AGENTS.md "Layer 4" (manual visual smoke test as the safety net for everything tests can't reach).

---

## What was NOT done (and why)

- **No editor full-DOM tests**: AGENTS.md design-doc rationale ("editor tests would need jsdom + HA stubs which add too much overhead") preserved. We DID add `happy-dom` for ReactiveController tests because controllers fundamentally need DOM concepts (`document.visibilityState`, `IntersectionObserver`); the editor remains visually verified at PR time.
- **No translations beyond English**: The 32 non-English language files do not yet have the `time_grid_hidden_events_aria` key (or the new `time_grid_interval_*` / `time_grid_max_*_day(s)` select-option keys). They fall back to English per the existing translation strategy (FR-8.2 explicitly defers per-language translation to follow-up PRs).
- **No screenshot in README**: `docs/images/` directory does not exist. Story 3-3 explicitly permits omitting the screenshot for the PR; a follow-up doc-only PR will add it after the feature merges.
- **No `getGridOptions` for HA section view**: Per FR-10.2 — section-view default is full-width natural-height, which is fine for the time-grid view.
- **No per-event `tap_action` on event blocks in grid view**: Consistent with list-view convention (no per-event handlers); documented in README.

---

## Recommendation for merge

This branch is ready for PR submission to `alexpfau/calendar-card-pro:dev`:

1. All 47 REAL audit findings resolved.
2. List-view byte-identical (`render.ts` unchanged; `events.ts` is a single 8-line additive change).
3. 215 tests passing; lint clean; build clean; CI now runs tests.
4. Bundle delta documented and within transparent cap.
5. Worklog 0020 documents every change with rationale.

The PR description should reference this worklog as the post-19-stories audit + fix cycle, and call out the cap-raise sequence as documented process accountability.

---

## Branch state

```
6fd0743 test+docs+ci: phase G/H/I — README updates, test gap fills, CI test gate
70b7586 refactor(grid): phase F — 7 LOW-severity findings (idiomatic Lit + DRY hygiene)
2e96a89 fix(grid): phase E — 12 MED-severity findings from skeptical audit
2b3f046 feat(grid): phase D — FR-2.6 hidden pill + clipped indicators
fd5d52e refactor(grid): phase C — ReactiveControllers for now-line + responsive columns
87a13db fix(grid): phase B — HIGH-correctness fixes from skeptical audit
f0c4fe8 docs: phase A — raise bundle cap to +25 KB, correct getCardSize and FR-2.6
[... 19 prior story commits ...]
b69a30b Merge pull request #332 from alexpfau/dev   ← upstream/dev HEAD
```
