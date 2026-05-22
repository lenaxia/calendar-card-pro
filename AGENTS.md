# calendar-card-pro Documentation — AGENTS.md

**This is the ONLY document an agent needs to read to start contributing to calendar-card-pro.**

All essential information for AI/coding agents is consolidated here. The design doc (`docs/design/time-grid-view.md`) is referenced for deep dives only.

---

## Project Overview

**calendar-card-pro** is a Home Assistant Lovelace custom card written in TypeScript that renders calendar events from HA calendar entities. It is a **pure UI component** — no backend, no scheduling, no event creation. It reads events via the HA WebSocket/REST API and renders them.

**Stack**: TypeScript (strict), Lit 3.3, esbuild via rollup, ESLint flat config + Prettier. No runtime dependencies beyond Lit and dayjs (for relative-time strings).

**Active feature**: A **time-grid view** (Google-Calendar-style) is being designed to address [issue #300](https://github.com/alexpfau/calendar-card-pro/issues/300). The list view (the only existing view) is unchanged. See `docs/design/time-grid-view.md` for the full design (currently v13, ~1500 lines).

### External References

```
ALEXPFAU_ROOT  = upstream remote (alexpfau/calendar-card-pro on GitHub)
LENAXIA_ROOT   = origin remote (lenaxia/calendar-card-pro on GitHub) — your fork
LOCAL_ROOT     = ~/personal/calendar-card-pro
HA_DEV_DOCS    = https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/
```

---

## CRITICAL RULES — READ BEFORE CODING

### 0. MANDATORY WORK LOGS (ALWAYS REQUIRED)

**EVERY task, design pass, or significant work session MUST create a work log before completion.**

**A task is NOT complete without a work log. No exceptions.**

- Create work log at end of EVERY task
- Document what was done, decisions made, what was verified vs. assumed
- Include build/lint/test results
- Commit work log alongside code changes (or with the design doc if no code yet)

**Format**: `NNNN_YYYY-MM-DD_description.md` in `docs/design/`

**Get the next sequence number:**
```bash
cd docs/design
NEXT=$(printf "%04d" $(($(ls -1 [0-9][0-9][0-9][0-9]_*.md 2>/dev/null | sed 's/_.*//' | sort -n | tail -1) + 1)))
```

### 1. STATE ASSUMPTIONS UP FRONT, THEN VALIDATE THEM (CRITICAL)

**Before writing code OR design prose, list every assumption you're about to make. Then validate each one against the source code. Do not proceed on unvalidated assumptions.**

This is the single most important rule. The design doc for the time-grid view went through 12 review passes, and every pass found bugs that came from unstated or unvalidated assumptions. Examples:

- "v9-F3": assumed `hasConfigChanged` would naturally detect view changes — it didn't (would have shipped stale data on view toggle)
- "v10-F2": assumed `Math.floor((b - a) / 86400000)` was correct for day differences — it isn't across DST (would have silently glitched twice per year)
- "v11-F5": assumed the host already passed the override to `fetchEventData` — it didn't (would have shipped grid view with broken navigation)

**The pattern that prevents these:**

1. List assumptions in a table at the top of the design/plan, each tagged with **how it was verified** (file:line citation, test command output, doc URL)
2. Mark each as ✅ Verified / ⚠ Open / ❌ Falsified
3. Re-read the cited source. Do not trust memory of a previous session
4. When uncertain, **say so explicitly** with a confidence level (LOW/MEDIUM/HIGH) and ask

**Forbidden patterns:**
```
"This must be the way it works because…"           [trust no inference]
"I think the existing code does X"                 [verify by reading]
"This is probably similar to Y"                    [check it]
"It worked before, so it should work now"          [re-verify after changes]
"The function probably handles edge case E"        [test it]
```

**Required pattern:**

```
Assumption: "setConfig merges shallow via {...DEFAULT, ...config}"
Verified by: src/calendar-card-pro.ts:478 (read directly)
Status: ✅ Verified — this means nested object defaults are LOST when user provides
        a partial nested object. Affected fields must be flat scalars OR get a
        deep-clone special case (see existing `weather` config in helpers.ts:346).
```

### 2. NEVER MAKE CLAIMS YOU CAN'T PROVE (CRITICAL)

**Every assertion in design docs, code comments, work logs, or PR descriptions must be backed by code, citation, or empirical test.**

**If you claim X exists:**
- Show the file path and line number where X is defined
- Show the actual source text, obtained by reading the file or running grep

**If you claim X does not exist:**
- Show the grep/search command and its (empty) output as proof of absence
- Search **all** plausible locations — `src/`, `node_modules/lit/`, the rollup output, etc.
- Absence from one file does not mean absence from all files

**If you claim X behaves a certain way:**
- Cite the specification (HA docs, MDN, Lit docs) OR
- Show the actual code that implements the behavior OR
- Run a test that demonstrates it

**Forbidden patterns** — never write these without proof:
```
"There is no API for this"
"Lit's @property always triggers a re-render"        [verify identity check semantics]
"HA's calendar API returns events that overlap"      [cite docs]
"This config option has no effect in grid view"      [grep usage]
"This pattern is consistent with the existing card"  [show the existing pattern]
```

**When uncertain: say so and verify, don't guess.** Confident-sounding wrong claims propagate into design decisions and become bugs.

### 3. NEVER PERFORM DESTRUCTIVE GIT OPERATIONS (CRITICAL)

Multiple agents may work in this repository simultaneously.

**FORBIDDEN:**
- `git checkout .` — discards ALL uncommitted changes
- `git reset --hard` — destroys work from other agents
- `git clean -fd` — deletes untracked files indiscriminately
- `git push --force` to `dev` or `main` — never; rewrites shared history
- `git rebase` on shared branches without explicit user approval

**REQUIRED:**
- Revert files ONE AT A TIME with explicit user confirmation
- Always check `git status` before any revert
- Ask the user for confirmation before reverting any file
- For PR branches, prefer `git revert <sha>` over `git reset --hard`

### 4. PR TARGET IS `dev`, NOT `main` (PROJECT CONVENTION)

Per `CONTRIBUTING.md`, all PRs target the `dev` branch (despite a stale comment elsewhere in the doc that says `main`). Verified by reading the file.

```bash
# CORRECT
git fetch upstream
git checkout -b feature/foo upstream/dev
# ... commit ...
git push origin feature/foo
# Open PR with base = alexpfau/calendar-card-pro:dev, compare = lenaxia/calendar-card-pro:feature/foo
```

### 5. LIST VIEW IS UNTOUCHABLE (HARD INVARIANT)

**The existing list view rendering path must remain byte-for-byte unchanged.**

Specifically: `src/rendering/render.ts` is **not** modified by the time-grid feature, and `src/utils/events.ts` is modified only by adding **one optional argument** (`effectiveDaysToShow?: number`) to `fetchEventData`. Existing callers (the list view) pass nothing for this arg → behavior is byte-identical.

This is enforced by code review and a manual visual smoke test. There is no automated snapshot guard (Lit SSR snapshot was rejected as overengineering — see design doc revision history).

```bash
# Before merging any time-grid PR:
git diff upstream/dev -- src/rendering/render.ts          # must be empty
git diff upstream/dev -- src/utils/events.ts | grep -v "effectiveDaysToShow"  # must show no other changes
```

### 6. NO `any` TYPES (LINT-ENFORCED)

`@typescript-eslint/no-explicit-any: error` is enforced by `eslint.config.mjs`. CI will reject PRs with `any`.

```typescript
// FORBIDDEN
function process(config: any) { ... }

// REQUIRED — concrete type, or `unknown` with narrowing
function process(config: Types.Config) { ... }
```

If you genuinely need a permissive type for a field that comes from external code (HA, card-mod), use `unknown` and narrow it:

```typescript
function readExternal(value: unknown): string {
  if (typeof value !== 'string') throw new Error('expected string');
  return value;
}
```

### 7. NO INLINE COMMENTS THAT RESTATE THE CODE

Code should be self-documenting. JSDoc on **public/exported functions** is required. Inline comments should explain **why**, not **what**.

```typescript
// FORBIDDEN — restates code
const x = a + b;  // add a and b

// FORBIDDEN — adds noise
function foo() {
  // initialize
  let count = 0;
  // increment
  count++;
}

// CORRECT — explains why
// Round (not floor) to handle DST: spring-forward gives 23h day, floor → 0 instead of 1.
return Math.round((b.getTime() - a.getTime()) / 86400000);
```

### 8. TEST-DRIVEN DEVELOPMENT WHERE PRACTICAL

Pure helpers (`src/utils/grid.ts`, etc.) **MUST** have tests written before implementation. The time-grid feature plan (Phase 1–3 in the design doc §12):

1. Add Vitest scaffold
2. Write all tests for pure helpers (red — they fail)
3. Implement helpers (green — tests pass)

**Tests are not optional for new pure helpers.**

For UI rendering (Lit components, editor), automated tests are deferred — they require `jsdom` + HA stubs which add too much overhead. Use:
- Code review (the dispatch guard guarantees list-view non-regression)
- Manual visual smoke test against a real HA instance

### 9. NEVER COMMIT `package-lock.json` CHANGES FROM `npm install` ALONE

If you ran `npm install` to set up your local environment, the resulting `package-lock.json` drift is local-only and should NOT be committed unless you also added/removed/upgraded a dependency.

Before committing:
```bash
git status
# If only package-lock.json shows as modified, AND you didn't change package.json:
git checkout -- package-lock.json
```

### 10. ASK BEFORE DECIDING (MANDATORY)

**Never assume architectural choices. State the trade-offs and ask.**

When uncertain about:
- Whether a config field should be flat or nested (the answer is **flat scalar** in this repo, due to the shallow-merge bug at `setConfig`)
- Whether a field should be exposed in the editor or YAML-only
- Whether to add a new test framework, dependency, or build step
- Any deviation from `CONTRIBUTING.md`, the design doc, or existing conventions

…cite specific evidence from source/docs/issues and ask the user.

---

## Defense-in-Depth: How We Prevent Errors From Reaching `dev`

The time-grid design doc went through 12 self-review passes and accumulated ~128 findings (~82 real bugs caught pre-implementation). The process that surfaces these:

### Layer 1: Read the Source

Before claiming the code does something, **read the file**. Memory of past sessions is unreliable; the file is authoritative.

```bash
# CORRECT
sed -n '482,500p' src/calendar-card-pro.ts   # read setConfig directly
grep -n "show_past_events" src/utils/events.ts
```

### Layer 2: Verify Numerically

Math claims (especially around dates, DST, pixel layouts, getCardSize) must be verified with concrete numerical examples.

```bash
node -e "
// Verify daysBetween across DST spring-forward
const a = new Date(2026, 2, 8);  a.setHours(0,0,0,0);   // pre-DST
const b = new Date(2026, 2, 9);  b.setHours(0,0,0,0);   // post-DST
console.log('floor:', Math.floor((b - a) / 86400000));  // 0 — wrong!
console.log('round:', Math.round((b - a) / 86400000));  // 1 — correct
"
```

### Layer 3: Run Lint and Build

```bash
npm run lint     # zero warnings
npm run build    # bundle output in dist/calendar-card-pro.js
npm test         # if tests are added (Phase 1+ for time-grid)
```

CI runs lint + build on PRs to `main` and `dev` (`.github/workflows/ci.yml`).

### Layer 4: Self-Review with Adjudication Discipline

When iterating on a design or implementation, after each change:

1. Re-read the modified sections fresh
2. List **all** findings (don't filter as you go)
3. Adjudicate each one: **REAL / PARTIAL / NON-ISSUE** with cited evidence
4. Apply only the REAL fixes; document the PARTIAL deferrals; explicitly mark NON-ISSUES so they aren't re-raised

This is how the time-grid design caught the v11-F5 host-side bug after 10 prior passes. The pattern: probe an area you haven't focused on yet → likely find something.

### When Source, Design Doc, and Implementation Conflict

The hierarchy of authority:

```
Existing source code in src/                ← always wins for "how it works today"
       ↓
docs/design/time-grid-view.md (vN)          ← authoritative for the feature; update if drift
       ↓
docs/architecture.md                        ← high-level structure; update if drift
       ↓
CONTRIBUTING.md                             ← process; align all of the above to it
       ↓
README.md                                   ← user-facing; update last
```

When a conflict is found:
1. Read the source. That is what runs.
2. Update the design doc to match if the source is correct.
3. Document the discrepancy in the work log.
4. If the source is the bug, fix it (with tests).

---

## Architecture

### Top-level Structure

```
calendar-card-pro/
├── src/
│   ├── calendar-card-pro.ts       host element — Lit component, lifecycle, render dispatch
│   ├── config/
│   │   ├── types.ts               Config interface, ActionConfig, EntityConfig
│   │   ├── config.ts              DEFAULT_CONFIG, hasConfigChanged
│   │   └── constants.ts           timing/cache constants
│   ├── utils/
│   │   ├── events.ts              fetchEventData, processEvents, groupEventsByDay,
│   │   │                          getTimeWindow, splitMultiDayEvent (private),
│   │   │                          getStartDateReference (private)
│   │   ├── format.ts              parseAllDayDate, formatTime, getFirstDayOfWeek,
│   │   │                          getLocalDateKey
│   │   ├── helpers.ts             generateDeterministicId, filterDefaultValues
│   │   ├── logger.ts
│   │   └── weather.ts             weather forecast subscription helpers
│   ├── interaction/
│   │   ├── actions.ts             tap_action / hold_action handling
│   │   └── feedback.ts            visual feedback for hold gestures
│   ├── rendering/
│   │   ├── render.ts              list-view render functions (NEVER modify for time-grid)
│   │   ├── render-grid.ts         (PLANNED) time-grid render functions
│   │   ├── styles.ts              CSS in Lit static styles + per-config custom properties
│   │   └── editor.ts              hand-rolled LitElement editor (not ha-form schema)
│   └── translations/
│       ├── localize.ts            translate(), getTranslations(), hasEditorTranslations()
│       ├── dayjs.ts               dayjs locale loading for relative-time strings
│       └── languages/
│           ├── en.json            English (the fallback when other languages are missing)
│           └── (32 others)
├── docs/
│   ├── architecture.md            high-level architecture description
│   └── design/
│       ├── time-grid-view.md      design doc for issue #300 (v13)
│       └── 0001_2026-05-20_*.md   work logs (this file format)
├── dist/                          build output (gitignored)
├── package.json                   scripts: lint, build, format, format:check
├── rollup.config.mjs              rollup + esbuild bundle config
├── eslint.config.mjs              flat ESLint config
├── tsconfig.json                  TS strict, ES2017 target, noEmit (esbuild compiles)
├── CONTRIBUTING.md                process rules
└── README.md                      user-facing docs
```

### Lifecycle (Lit Component)

```
constructor
  ↓
connectedCallback                    [DOM-attached; can read offsetWidth (forces layout)]
  ↓ (Lit schedules update microtask)
willUpdate(changedProps)
  ↓
update(changedProps)                 [calls render()]
  ↓
render()                             [returns TemplateResult]
  ↓ (DOM commit)
firstUpdated                         [first only]
  ↓
updated(changedProps)                [every update]
  ↓ (any reactive prop change)
willUpdate → update → render → updated  [loop]
  ↓ (element removed)
disconnectedCallback                 [cleanup observers, intervals]
```

**Key implication for the time-grid feature**: `connectedCallback` runs **before** the first `render`. Reading `this.offsetWidth` there forces a synchronous layout pass and gives a valid initial width — `firstUpdated` would be too late.

### Data Flow (List View — Existing)

```
HA hass object updates
  ↓
@property hass setter triggers update
  ↓
updateEvents() called from connectedCallback / hass change / refresh timer / visibilitychange
  ↓
fetchEventData(hass, config, instanceId, force?)
  ↓
  HA REST API: callApi('GET', `calendars/${entity}?start=…&end=…`)
  ↓
  processEvents (allowlist/blocklist/duplicates/labels)
  ↓
  filter to days_to_show window
  ↓
  cache in localStorage by composite key
  ↓
this.events = [...result]            [reactive prop, triggers re-render]
  ↓
render() dispatches:
  isInitialLoad → 'loading' state
  !safeHass || !entities → 'error' state
  events.length === 0 → empty state
  default → renderGroupedEvents(groupedEvents, …)
              ↑ getter that calls groupEventsByDay each render
  ↓
TemplateResult committed to DOM by Lit
```

### Data Flow (Time-Grid View — Planned)

```
[same fetchEventData chain, but with effectiveDaysToShow=time_grid_navigation_days when view='time-grid']
  ↓
this.events populated
  ↓
render() dispatches:
  isInitialLoad → 'loading' state
  !safeHass || !entities → 'error' state
  config.view === 'time-grid' → renderTimeGrid(events, config, language, ctx)
                                  [BYPASSES groupEventsByDay; consumes events directly]
  events.length === 0 → list empty state
  default → list normal state
  ↓
ResizeObserver on host updates visibleDays (1/3/7) per width
  ↓
60s interval updates now-line position imperatively (no Lit re-render)
  ↓
Same interval detects midnight → calls requestUpdate() to refresh "today" highlighting
```

### Configuration Schema (Existing + Planned Additions)

The full schema is in `src/config/types.ts`. Critical patterns:

- **Top-level scalar fields only** for new options. Nested objects break due to the shallow-merge bug at `src/calendar-card-pro.ts:478` (`{ ...DEFAULT_CONFIG, ...config }` destroys nested partials). The existing `weather` config sidesteps this with a special-case deep-clone in `helpers.ts:346`; we don't add more such cases.
- **`DEFAULT_CONFIG`** in `src/config/config.ts` — every new field MUST have an entry here so `filterDefaultValues` can omit defaults from saved YAML.
- **`hasConfigChanged`** in `src/config/config.ts` — controls whether a config change triggers a refetch. Adding a new fetch-affecting field requires updating this function.

---

## Build & Validation Commands

```bash
# Standard build (production)
npm run build

# Dev build (watch mode, dev custom-element name 'calendar-card-pro-dev')
npm run dev

# Lint (ESLint flat config + Prettier; fails on warnings)
npm run lint

# Format (auto-fix)
npm run format

# Format check (CI-equivalent)
npm run format:check

# Tests (when Vitest is added in Phase 1 of the time-grid feature)
npm test
npm run test:watch
```

CI runs `npm run lint` and `npm run build` on every PR (`.github/workflows/ci.yml`).

---

## Common Mistakes to Avoid

### 1. Adding a nested object to Config

```typescript
// FORBIDDEN — shallow-merge bug at setConfig:478 will lose nested defaults
time_grid_breakpoints: { three_day: 500, seven_day: 900 }

// CORRECT — flat scalars
time_grid_breakpoint_three_day_px: 500;
time_grid_breakpoint_seven_day_px: 900;
```

### 2. Modifying `src/rendering/render.ts` for the time-grid feature

```bash
# CHECK before any commit:
git diff upstream/dev -- src/rendering/render.ts
# If non-empty, you're breaking the FR-1.2 invariant.
```

### 3. Using `firstUpdated` for initial width measurement

```typescript
// WRONG — runs AFTER first render, requires re-render to take effect
firstUpdated() {
  this.visibleDays = chooseVisibleDays(this.offsetWidth, ...);
}

// CORRECT — connectedCallback runs BEFORE first render scheduling
connectedCallback() {
  super.connectedCallback();
  this._applyVisibleDays(this.offsetWidth);  // forces layout, gets valid width
}
```

### 4. Using `Math.floor` for date difference math

```typescript
// WRONG — DST spring-forward gives a 23h day, floor returns 0 instead of 1
const days = Math.floor((b.getTime() - a.getTime()) / 86400000);

// CORRECT — round handles ±1h DST and ±30min DST (Lord Howe)
const days = Math.round((b.getTime() - a.getTime()) / 86400000);
```

### 5. Using inline comments to restate code

```typescript
// FORBIDDEN
const start = config.time_grid_start_hour;  // get start hour

// CORRECT — no comment needed; identifier is self-documenting
const start = config.time_grid_start_hour;
```

### 6. Adding `any` to a function signature

ESLint will reject it. Use concrete types or `unknown` with narrowing.

### 7. Targeting the wrong PR base branch

Per CONTRIBUTING.md, PRs target `dev`, not `main`. Verify before opening.

### 8. Committing `package-lock.json` from `npm install` alone

If you didn't change `package.json`, revert the `package-lock.json` change before committing.

### 9. Trusting a previous session's notes without re-verifying

The source has changed since you last looked. Re-read it.

### 10. Skipping the assumption-validation step

Before designing or implementing, list every assumption in a table. Verify each. Mark uncertain ones explicitly. Don't proceed on unvalidated assumptions.

---

## Work Log Directory

**Format**: `docs/design/NNNN_YYYY-MM-DD_description.md`

**Content requirements:**
- What was done (concrete files modified, lines changed)
- What was verified vs. assumed (cite source file:line for verifications)
- Build/lint results
- Test results (if applicable)
- Any open questions or follow-ups

**Get next sequence number:**
```bash
cd docs/design
NEXT=$(printf "%04d" $(($(ls -1 [0-9][0-9][0-9][0-9]_*.md 2>/dev/null | sed 's/_.*//' | sort -n | tail -1) + 1)))
echo "Next: $NEXT"
```

**Existing work logs:**
- `0001_2026-05-20_time-grid-view-design.md` — design phase (12 review passes, no code yet)

---

## Quick Reference

### Essential Files to Read Before Implementing Anything

| File | Purpose | When to Check |
|---|---|---|
| `CONTRIBUTING.md` | PR target branch, lint/build commands, style notes | Before first commit |
| `docs/architecture.md` | High-level architecture, directory tree | Before adding new files |
| `docs/design/time-grid-view.md` | Time-grid feature design (v13, ~1500 lines) | Before any time-grid work |
| `src/calendar-card-pro.ts` | Host component lifecycle, render dispatch, setConfig, updateEvents | Always |
| `src/utils/events.ts` | Event fetch + processing pipeline | Before touching fetch logic |
| `src/config/types.ts` | Config interface | When adding config fields |
| `src/config/config.ts` | DEFAULT_CONFIG, hasConfigChanged | When adding config fields |
| `src/rendering/render.ts` | List-view render path (DO NOT MODIFY for time-grid) | Reference only |
| `src/rendering/styles.ts` | CSS-in-Lit, custom properties | When adding styles |
| `src/rendering/editor.ts` | Editor patterns (hand-rolled, not ha-form) | When adding editor fields |
| `eslint.config.mjs` | Lint rules — `any` is error, `import/order`, etc. | If lint fails |
| `tsconfig.json` | TS strict, ES2017, lib includes ResizeObserver | If TS errors |

### Key Design Decisions Summary (Time-Grid Feature)

| Decision | Why |
|---|---|
| `view: 'list' \| 'time-grid'` discriminator field | Single mode flag, room for future `'month-grid'` |
| All grid config as flat top-level scalars | Avoids the `setConfig` shallow-merge bug; matches existing convention |
| `time_grid_navigation_days` separate from `days_to_show` | Decouples grid fetch range from list-view setting |
| `effectiveDaysToShow?` optional arg on `fetchEventData` | Additive; preserves list-view behavior byte-identically |
| Pure helpers in `src/utils/grid.ts` | Unit-testable without DOM/Lit/HA mocks |
| `SLOT_HEIGHT_PX = 24` as code constant, not CSS variable | Avoids inconsistency between renderer / now-line / getCardSize |
| `border-inline-start` (not `border-left`) | RTL-correct; matches existing list-view pattern |
| Imperative now-line update + midnight refresh | Avoids full Lit re-render every minute |
| Cluster-based overlap packing | Standard Google Calendar UX |
| Vitest for new pure helpers; no editor/UI tests | Right-sized; editor tests would need jsdom + HA stubs |
| Bundle size cap +20 KB minified | Realistic for new module + helpers + CSS |

---

**Last Updated**: 2026-05-20 (design v13 complete; no code yet; 12 self-review passes done)
**Active Feature Design**: `docs/design/time-grid-view.md`
**Active Worklog**: `docs/design/0001_2026-05-20_time-grid-view-design.md`
**Process Authority**: `CONTRIBUTING.md`
**Architecture Authority**: `docs/architecture.md`
