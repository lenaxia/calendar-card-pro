# 0007 — Story 0-5: Render Dispatch + Minimal Host Wiring

**Date**: 2026-05-22
**Story**: [docs/epics/epic00/story0-5.md](../epics/epic00/story0-5.md)
**Depends on**: stories 0-3 (config schema), 0-4 (renderer)

---

## What was done

Connected the time-grid renderer (story 0-4) to the host component so `view: 'time-grid'` actually renders. Smallest possible host change; nothing in the list-view path is touched.

### Files modified

| File | Change | Net lines |
|---|---|---|
| `src/calendar-card-pro.ts` | +1 import, +2 reactive props, +1 dispatch branch | +22 |

No other files modified.

---

## Verified vs. assumed

| Assumption | Status | Evidence |
|---|---|---|
| `import * as Render from './rendering/render'` exists at line 40 | ✅ Verified | `src/calendar-card-pro.ts:40` (read directly) |
| Render dispatch chain at lines 614–660 | ✅ Verified | `src/calendar-card-pro.ts:614-660` (read directly); error check at 632, list-empty at 635, default at 651 |
| @property fields cluster at lines 79–88 | ✅ Verified | `src/calendar-card-pro.ts:79-88` (read directly); `isExpanded` at line 84 |
| `effectiveLanguage` getter exists | ✅ Verified | `src/calendar-card-pro.ts:130` |
| `safeHass` getter exists | ✅ Verified | `src/calendar-card-pro.ts:123` |
| `renderTimeGrid` signature `(events, config, language, ctx, hass?)` | ✅ Verified | `src/rendering/render-grid.ts:74-80` |
| `TimeGridContext` shape matches placeholder ctx | ✅ Verified | `src/rendering/render-grid.ts:28-37` |
| ESLint `no-empty-function` rule is NOT enabled (so `() => {}` is fine) | ✅ Verified | `eslint.config.mjs:27-52` — only `no-unused-vars`, `no-explicit-any`, `import/order`, `prettier/prettier`, `sort-imports` are configured; no `no-empty-function` rule |
| `now: new Date()` in ctx is acceptable for this story | ✅ Verified per story line 39–51 | Story explicitly specifies this for epic00; midnight refresh deferred to epic02 |

---

## Rule 5 invariant verification

```bash
$ git diff --stat HEAD -- src/rendering/render.ts
# (empty output)

$ git diff --stat HEAD -- src/utils/events.ts
# (empty output)

$ git diff --stat HEAD -- src/calendar-card-pro.ts
 src/calendar-card-pro.ts | 22 ++++++++++++++++++++++
 1 file changed, 22 insertions(+)
```

Static check of list-view branches (lines 635–660 pre-edit, now lines 656–681 post-edit): the empty-events branch and default branch are byte-identical to HEAD. The only inserted code sits between the error branch and the empty-events branch.

---

## Build / lint / test results

```
$ npm run lint        → clean (no output, no warnings)
$ npm test            → 59/59 passed (test/utils/grid.test.ts)
$ npm run build       → succeeded, dist/calendar-card-pro.js
```

### Bundle size delta

| Build | Bytes |
|---|---|
| Before story 0-5 (story 0-4 baseline) | 289,534 |
| After story 0-5 | 297,673 |
| Delta | **+8,139** |

The renderer module from story 0-4 was previously tree-shaken (no consumer); this story imports it from the host, so it's now retained in the bundle. Well within the design doc's +20 KB budget.

---

## Decisions

- Empty placeholder handlers `() => {}` for `onShiftDay` and `onShiftWindow` per the story spec. The lint config does not include `no-empty-function`, so no special form is needed. Real handlers arrive in epic01.
- `onResetToToday` is implemented (sets `viewOffsetDays = 0`) per story line 47, even though it's effectively a no-op until epic01 starts mutating `viewOffsetDays` from nav buttons.
- `canShiftBack` / `canShiftForward` hard-coded to `false` per story line 49.
- Insertion order in `render()`: time-grid branch placed **after** the error check (line 634) and **before** the list-empty check (line 635 pre-edit). This matches the dispatch order in story 0-5 line 32–38 and ensures list view's `events.length === 0` path never executes for grid view (so an empty grid still renders the time axis, not the list-empty message).

---

## Manual smoke test (deferred)

Per AGENTS.md §8, UI smoke testing against a real Home Assistant instance is deferred to PR review (jsdom + HA stubs are not set up). Two manual checks required at PR time:

1. `view: 'list'` (or no `view` field) → list view renders identically to `upstream/dev`.
2. `view: 'time-grid'` → grid renders, events appear in their slots, no console errors.

---

## Out of scope (deferred to later stories)

- ResizeObserver to drive `visibleDays` from host width (epic01)
- Real navigation handlers `<` `>` `<<` `>>` (epic01)
- Today button proper offset snap (epic01)
- Now-line interval & midnight refresh (epic02)
- `getCardSize()` for the grid view (story 0-7)
- `effectiveDaysToShow` plumbing through `fetchEventData` (epic01)
- All-day banner (epic02)

---

## Open questions

None.
