# Worklog 0021 — Time-Grid Visual Polish & UX Fix Cycle (RC3–RC11)

**Date**: 2026-05-24
**Branch**: `feature/time-grid-week-view`
**Trigger**: User deployed RC1 and reported multiple visual/UX issues from live testing.
**Scope**: Layout alignment, navigation UX, event interaction, scrollbar behavior, text contrast.
**Outcome**: 9 incremental RCs (RC3–RC11) addressing all reported issues; 215 tests passing; build clean.

---

## Summary of Issues Reported & Fixed

| RC | Issue | Root Cause | Fix |
|----|-------|-----------|-----|
| RC3 | Events not aligned with time slots | `.ccp-grid-hour-label` was ~16px tall (font-size only); events positioned assuming 48px/hr | Set explicit `height: var(--calendar-card-grid-hour-height)` on hour labels; pass computed values as CSS vars from renderer |
| RC3 | Events not taking full column width | `.ccp-grid-day-column` had `min-height: 24px`; absolutely-positioned events had no containing block height | Set explicit `height: var(--calendar-card-grid-column-height)` on day columns |
| RC3 | No alternating row colors | No CSS for visual alignment | Added `repeating-linear-gradient` with 1px hour lines + alternating 3% tint bands |
| RC3 | Scrollbar reflow on hover | `scrollbar-width` toggled from `none` to `thin` on hover | `scrollbar-gutter: stable` + transparent track that shows color on hover only |
| RC3 | Events appeared double-height | Same as #1 — time axis was half expected height | Fixed by #1 |
| RC3 | `.ccp-grid-body` column mismatch | Inline `gridTemplateColumns` set 4 columns but body has 2 children | Removed inline override; static CSS `48px 1fr` is correct |
| RC4 | Nav buttons too small for touch | `padding: 2px 6px` | `min-width/height: 36px`, larger padding, `font-size: 18px` |
| RC4 | "Today" not obviously a button | Plain text styling | Accent-colored pill with border, distinct hover/active states |
| RC4 | Date range redundant | Showed "May 26 – May 28, 2026" | Removed; replaced with month/year label |
| RC4 | Nav buttons triggered card tap action | `pointerdown` bubbled to `ha-card` | Added `@pointerdown` stopPropagation on all nav buttons |
| RC5 | Entire card was single touch element | `ha-card` had pointer handlers + `<ha-ripple>` | Disabled handlers (no-ops) and removed ripple for grid view; added `view-grid` class with `cursor: default` |
| RC5 | No month indicator | Removed with date range | Added `formatMonthYear()` — shows "May 2026" or "May – Jun 2026" |
| RC6 | No event interaction | Events were static blocks | Added click handler dispatching event detail; hover/active brightness feedback |
| RC6 | No column separation | `border-inline-start: transparent` | Changed to 10% opacity visible border |
| RC7 | Event detail dialog broken | Used HA's `show-dialog` with `whenDefined` — component not loaded | — |
| RC8 | — | — | Built custom inline overlay popup (no HA dependency) |
| RC9 | Event time/location unreadable | Used `--secondary-text-color` on colored event background | Removed explicit color; inherits event text color with 0.85 opacity |
| RC9 | Location not actionable | Plain text | Added Google Maps link + copy button |
| RC10 | Forced Google Maps | User de-googling | Removed link; kept copy-to-clipboard only |
| RC11 | Copy button ⧉/✓ size mismatch | Different glyph widths caused reflow | Fixed 28×24px button size |
| RC11 | Redundant « » in 1-day view | Same as ‹ › | Conditionally hidden when `visibleDays === 1` |

---

## Architecture Decisions

1. **CSS variables for grid dimensions**: `--calendar-card-grid-hour-height` and `--calendar-card-grid-column-height` are computed in JS from config (`SLOT_HEIGHT_PX`, `intervalMin`, start/end hour) and set as inline styles on `.ccp-grid-body`. CSS references these with fallback defaults. This keeps the layout responsive to config changes without hardcoded px values in CSS.

2. **No HA dialog dependency**: HA's `dialog-calendar-event-detail` requires the calendar panel to have been loaded (lazy-loaded component). Custom cards can't reliably import from HA's source tree. Built a self-contained overlay popup instead.

3. **No forced map provider**: Location is plain text with copy-to-clipboard. Users paste into their preferred app. Platform-neutral.

4. **Grid view disables card-level interaction**: The list view uses the card as a tap/hold target (expand/collapse, navigation). The grid view has its own nav buttons and event click targets, so card-level pointer handlers are replaced with no-ops and `<ha-ripple>` is not rendered.

5. **Overlap layout unchanged**: The existing `layoutOverlaps` algorithm (cluster-based greedy lane assignment) handles overlapping events correctly. Added `margin-inline-end: 1px` for visual gap and `width: calc(N% - 2px)` to prevent overflow.

---

## Files Modified (RC3–RC11 cumulative)

| File | Changes |
|------|---------|
| `src/rendering/styles.ts` | Hour label height, day column height, alternating backgrounds, column borders, event contrast, nav button sizing, Today pill, overlay popup styles, copy button, scrollbar fix, view-grid cursor |
| `src/rendering/render-grid.ts` | Computed CSS vars, removed body gridTemplateColumns override, event width calc, event click handler, nav pointerdown stopPropagation, conditional « » buttons, month label, formatMonthYear helper |
| `src/rendering/render.ts` | Added `isGridView` param to `renderMainCardStructure`; conditionally omits `<ha-ripple>` and adds `view-grid` class |
| `src/calendar-card-pro.ts` | No-op handlers for grid view, `isGridView` flag, event detail overlay state + rendering, `html` import |

---

## Test Status

- 215 tests passing (unchanged from RC1)
- Build clean, lint clean
- No new test files added (visual/UX changes not unit-testable without DOM rendering harness)

---

## Remaining Work (identified, not started)

- Per-entity event colors in grid view (currently all use accent color)
- All-day banner click-to-detail
- Auto-scroll to current time on load
- Weather integration in grid view
- Swipe gestures for navigation
- Editor UI for time-grid settings
- README documentation update
- Remove unused `formatRangeLabel` export
