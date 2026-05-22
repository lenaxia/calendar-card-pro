# 0011 — Story 1-2: Navigation Handlers `<` `>` `«` `»` `Today`

**Date**: 2026-05-22
**Story**: [docs/epics/epic01/story1-2.md](../epics/epic01/story1-2.md)
**Status**: Implementation complete; awaiting validation/commit by user

---

## Files modified

| File | Change |
|---|---|
| `src/config/types.ts` | +1 field: `time_grid_navigation_days: number` (with JSDoc) — **carry-over** from story 1-4 (see note below) |
| `src/config/config.ts` | +1 entry: `time_grid_navigation_days: 28` in `DEFAULT_CONFIG` |
| `src/utils/grid.ts` | +1 export: `clampOffset(current, delta, max)` pure helper with JSDoc |
| `test/utils/grid.test.ts` | +1 import + `describe('clampOffset')` block with 5 cases |
| `src/calendar-card-pro.ts` | +2 private methods (`_maxOffset`, `_shiftDays`); render-dispatch ctx now passes real handlers and `canShiftBack` / `canShiftForward` flags |
| `src/rendering/render-grid.ts` | Replaced single-button nav bar with full `« ‹ Today › »` markup, including aria-label translations, `aria-disabled` strings, `event.stopPropagation()` on each click, and `visibleDays !== 7` guard for single-day buttons (FR-4.1) |

Total: 6 files, ~80 lines net.

---

## Verified vs assumed

| Item | How verified | Status |
|---|---|---|
| `viewOffsetDays` `@property` exists | `src/calendar-card-pro.ts:87` (read directly) | ✅ Verified |
| `visibleDays` `@property` exists | `src/calendar-card-pro.ts:88` | ✅ Verified |
| `time_grid_navigation_days` NOT yet in schema | grep on `types.ts`/`config.ts` returned empty | ✅ Verified (so this story adds it — see carry-over note) |
| `Localize.translate(language, key, fallback)` returns `string \| string[]` | `src/translations/localize.ts:177-181` | ✅ Verified — wrapped each call with `String(...)` to satisfy the template binding |
| Existing `aria-disabled='true'` CSS already styles disabled buttons (opacity 0.4, cursor not-allowed) | `src/rendering/styles.ts:734-738` | ✅ Verified — no CSS changes required this story |
| `nothing` already imported in `render-grid.ts` | `src/rendering/render-grid.ts:9` | ✅ Verified |
| Lit attribute binding for `aria-disabled` requires explicit `'true'`/`'false'` strings (HTML attr semantics) | Used explicit-string approach per story line 53 + AGENTS.md rule | ✅ Verified by manual code review of resulting markup |
| `event.stopPropagation()` blocks card-level pointerdown/up handlers | `src/calendar-card-pro.ts:443+` (`_handlePointerDown` listens on bubbled events) | ✅ Verified |
| Existing 63 tests pass on `dev` baseline | `npm test -- --run` before edits → 63 passed | ✅ Verified |
| `src/rendering/render.ts` and `src/utils/events.ts` untouched (Rule 5) | `git diff --stat HEAD` empty for both | ✅ Verified |

---

## Schema carry-over note

**`time_grid_navigation_days` is added in story 1-2, not story 1-4.**

Story 1-4 was originally scoped to add this field as part of the fetch-window plumbing (passing `effectiveDaysToShow` to `fetchEventData`, updating `hasConfigChanged`, getTimeWindow override). However, story 1-2's acceptance criteria reference `this.config.time_grid_navigation_days` in `_maxOffset()` (story line 25). To unblock story 1-2 without scope creep into story 1-4, **only the schema field + `DEFAULT_CONFIG` entry are added here**. Story 1-4 still owns:

- `effectiveDaysToShow?: number` optional arg on `fetchEventData`
- `hasConfigChanged` update to refetch on `time_grid_navigation_days` change (not yet in `hasConfigChanged`)
- `getTimeWindow` override at the host's call site
- Dispatch logic so `view==='time-grid'` passes `time_grid_navigation_days` through

Story 1-4's worklog should NOT claim it adds the schema field — that's done.

---

## Build / lint / test results

```
$ npm test -- --run
✓ test/utils/grid.test.ts (68 tests) 36ms        # 63 pre-existing + 5 new clampOffset
Test Files  1 passed (1)
     Tests  68 passed (68)

$ npm run lint
(no output = clean)

$ npm run build
src/calendar-card-pro.ts → dist...
created dist in 5.8s
```

**Bundle size**:
- Before story 1-2: 302,877 bytes (`dist/calendar-card-pro.js`)
- After story 1-2:  304,610 bytes
- **Delta: +1,733 bytes (~1.7 KB)** — within the 1-2 KB expectation

**Untouchable-file invariant**:
```
$ git diff --stat HEAD -- src/rendering/render.ts
(empty)
$ git diff --stat HEAD -- src/utils/events.ts
(empty)
```

Both files unmodified ✅.

---

## Manual smoke test note

A live HA smoke test was NOT run (no HA dev instance available in this session). The story's manual checklist (click `<<` shifts by N, `<` by 1, edge clamping, `Today` resets to 0, tap_action still fires elsewhere) should be performed at PR review time per the story's Definition of Done.

The pure math is fully covered by the new clampOffset tests (G-4.4 plus 4 boundary cases), so the most error-prone portion is verified.

---

## Decisions

1. **`aria-disabled` as explicit string `'true'`/`'false'`** rather than Lit's `?aria-disabled=` boolean-attribute pattern. Story line 53 explicitly requires aria-disabled (an HTML attribute that takes string values, not the `disabled` DOM property). This matches the existing CSS selector at `styles.ts:734` and avoids ambiguity about presence-vs-value semantics.

2. **`visibleDays !== 7` guard on single-step `<` `>` buttons** per FR-4.1. In 7-day mode the user only navigates by week (`«` `»` + `Today`); the single-day buttons render `nothing`.

3. **`stopPropagation()` on every nav button click** to prevent the card-level `tap_action` from firing. The host's `_handlePointerDown`/`_handlePointerUp` are bound on the card root and rely on event bubbling — without `stopPropagation`, clicking a nav button would also trigger the card's tap action.

4. **`Today` button never disabled**, even when `viewOffsetDays === 0`. The previous renderer disabled it via `?disabled=${todayIdx === 0 && ctx.offsetDays === 0}`; this is removed because story line 56 says Today is always functional (and once story 1-3 lands, `Today` will reset to `_todayOffset()` which may not be 0).

5. **Translation fallback strategy**: `Localize.translate(language, key, fallback)` returns `string | string[]`, so every call is wrapped with `String(...)`. The fallback strings include the `{n}` value already inlined for the window labels (e.g. `Previous 3 days`), and `.replace('{n}', String(ctx.visibleDays))` runs unconditionally so future translations using `{n}` placeholders also work.

6. **`onShiftWindow(d)` multiplies by `visibleDays`** at the host (`(d) => this._shiftDays(d * this.visibleDays)`), not at the renderer. This keeps the renderer pure: it just tells the host "shift one window in direction d".

---

## Out-of-scope deferrals (not blocking story 1-2)

- `_todayOffset()` math — story 1-3. `onResetToToday` still sets `viewOffsetDays = 0`.
- Localized button labels — epic03. Translation keys land in story 3-2; for now JS fallbacks include English text.
- Auto-scroll-to-now on mount — separate follow-up.

---

## Open questions

None — all assumptions verified, all acceptance criteria addressable have green status, lint/build/tests pass.
