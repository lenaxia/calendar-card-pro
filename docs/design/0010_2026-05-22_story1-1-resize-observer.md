# Story 1-1 — Responsive ResizeObserver + width-based visibleDays

**Date**: 2026-05-22
**Story**: [epic01/story1-1](../epics/epic01/story1-1.md)
**Status**: Implementation complete; awaiting validation

---

## Files modified

| File | Lines added | Purpose |
|---|---|---|
| `src/config/types.ts` | +6 | Three new fields: `time_grid_max_days`, `time_grid_breakpoint_three_day_px`, `time_grid_breakpoint_seven_day_px` (with JSDoc) |
| `src/config/config.ts` | +3 | Matching `DEFAULT_CONFIG` entries (7, 500, 900) |
| `src/calendar-card-pro.ts` | +56 | Two private fields (`_resizeObserver`, `_resizeRafId`), three private methods (`_syncObserver`, `_onResize`, `_applyVisibleDays`), lifecycle hooks in `connectedCallback`, `disconnectedCallback`, `updated()` |

Total: **+65 lines** across 3 files.

`hasConfigChanged` deliberately not modified — the new fields are render-only, not fetch-affecting.

## Files NOT modified (per story constraints + hard invariants)

| File | Reason |
|---|---|
| `src/rendering/render.ts` | List-view invariant (Rule 5) — `git diff --stat HEAD` is empty ✓ |
| `src/utils/events.ts` | Story 1-3 will add the optional arg; this story does not touch fetch (Rule 5) — empty diff ✓ |
| `src/rendering/render-grid.ts` | Nav-bar currently has only `Today` button + range span; no `<`/`>`/`<<`/`>>` buttons exist yet to wrap with a `visibleDays !== 7` guard. Story 1-2 introduces those buttons and will include the guard then. Documented in §"Renderer state finding" below. |

## Verified vs. assumed

| Claim | Verification | Status |
|---|---|---|
| `connectedCallback` is at `src/calendar-card-pro.ts:171` | Read directly | ✅ |
| `disconnectedCallback` is at line 188 | Read directly | ✅ |
| `updated(changedProps)` is at line 225 | Read directly | ✅ |
| `chooseVisibleDays` signature is `(widthPx, bpThreeDayPx, bpSevenDayPx, cap)` | `src/utils/grid.ts:162-167` | ✅ |
| `Grid` namespace import present at top of host file | `src/calendar-card-pro.ts:36` | ✅ |
| `visibleDays` reactive prop exists (story 0-5) and is typed `1 \| 3 \| 7` with default `7` | `src/calendar-card-pro.ts:88` | ✅ |
| Host has no pre-existing `_resizeObserver` field | grep on `_resizeObserver` in src/ before edit returned no hits | ✅ |
| `this.isConnected` is inherited from HTMLElement | DOM standard; Lit extends LitElement → ReactiveElement → HTMLElement | ✅ |
| `offsetWidth` in `connectedCallback` forces sync layout and returns valid width | MDN: HTMLElement.offsetWidth triggers reflow (sync layout pass); inherited from HTMLElement | ✅ |
| `time_grid_*` are flat scalars (no nested objects) — required by setConfig shallow-merge | `src/config/types.ts:113-128` (existing pattern) | ✅ |
| **Common Mistake #5 (ResizeObserver this-binding)**: callback wrapped in arrow function | `_syncObserver` body uses `new ResizeObserver(() => this._onResize())` with explanatory comment | ✅ Applied |
| `requestAnimationFrame` / `cancelAnimationFrame` are globally available in TS lib | TS includes DOM lib by default; `tsconfig.json` lib not narrowed | ✅ Build passes |
| Nav buttons in render-grid.ts | See §"Renderer state finding" | ✅ Read directly |

## Renderer state finding (story-mandated callout)

**The story task explicitly asked**: "did the renderer already render nav buttons as `nothing`, or were there real button elements?"

**Answer**: Neither. The current nav-bar markup at `src/rendering/render-grid.ts:118-127` contains:
- A single `Today` button
- A `<span class="ccp-grid-range">` showing the date range

That's it. No `<`, `>`, `<<`, or `>>` buttons exist. There aren't even `nothing` placeholders for them.

This means the story's suggested guard:
```ts
${visibleDays !== 7
  ? html`<button @click=${() => ctx.onShiftDay(-1)} ...>‹</button>`
  : nothing}
```
…has nothing to wrap. The buttons themselves get added in **story 1-2** (which wires real navigation handlers per story 1-1 line 84: "Real navigation handlers come in story1-2"). The most truthful course of action is to leave `render-grid.ts` untouched in this story and let story 1-2 add the buttons WITH the `visibleDays !== 7` guard already in place. This avoids dead code (a guard around nothing) and avoids "structure for future change" anti-patterns.

This is a deviation from the story's "Files touched" list (which mentions ~5 lines in render-grid.ts), but it's the correct deviation given the actual state of the code. Story 1-2's scope grows by exactly the guard mentioned here (~3 lines per button × 2 buttons = ~6 lines).

## Build / lint / test results

```
$ npm run lint
> eslint 'src/**/*.ts' 'test/**/*.ts' --fix --format stylish
(zero output → clean)

$ npm test
✓ test/utils/grid.test.ts (63 tests) 55ms
Test Files  1 passed (1)
Tests       63 passed (63)

$ npm run build
created dist in 6.3s
```

Bundle size: `dist/calendar-card-pro.js` is now 302,877 bytes. Previous size (post-story 0-7) per work log 0009 was ~302K, so the delta is well under 1KB — within story 1-1's "modest delta" expectation.

## Manual smoke test

**Deferred** — the validating environment cannot run a real Home Assistant instance. The story explicitly notes (line 85): "No tests added in this story for the lifecycle (Lit lifecycle requires jsdom + observer mock — out of scope per design doc §10)". Manual smoke test (resize browser 320 → 700 → 1200, observe 1 → 3 → 7 transition within ~1 frame) is on the user's checklist before merge.

## Deviations from story spec

1. **render-grid.ts not modified** (vs story line 109 saying "~5 lines"). Reason explained above; deferred to story 1-2 which adds the buttons themselves. This is the correct call given that wrapping non-existent buttons with a conditional produces dead code.

2. No other deviations. ResizeObserver, RAF coalescing, `_syncObserver` view-aware gating, `connectedCallback` initial seed, `disconnectedCallback` cleanup, and `updated(changedProps)` re-sync on config change all follow the story's pseudocode exactly.

## Defense-in-depth notes (Common Mistake #5 specifically)

The single line that prevents the most common runtime failure here is:
```ts
this._resizeObserver = new ResizeObserver(() => this._onResize());
```
The explanatory comment immediately above ("Arrow function preserves `this`…") is a "why" comment, not a "what" comment, and earns its keep per Rule 7.

**Anti-pattern that was avoided** (would have crashed at first resize):
```ts
this._resizeObserver = new ResizeObserver(this._onResize);  // FORBIDDEN
```

## Open questions / follow-ups

- Story 1-2 must remember to add the `<` `>` `<<` `>>` buttons WITH the `visibleDays !== 7` guard for the single-step pair. Worth noting in story 1-2's "Depends on" or "Notes" section.
- Editor surfacing of the three new config fields: deferred to epic03 (per story line 91).
