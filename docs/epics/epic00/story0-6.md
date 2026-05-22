# Story 0-6 — Grid CSS in `styles.ts`

**Epic**: [epic00 — Time-Grid Base View](README.md)
**Status**: Not started
**Estimate**: S (small — CSS only, ~2 hours)
**Depends on**: [story0-4](story0-4.md) (renderer must define class names)

---

## User story

> **As a** user looking at the new time-grid view,
> **I want** the grid to inherit the existing card's theme (colors, fonts, accent line) so it doesn't look out of place,
> **So that** my dashboard remains visually consistent across list-view cards and grid-view cards.

## Why this is needed

The renderer (story0-4) emits CSS classes (`ccp-grid`, `ccp-grid-day-column`, `ccp-grid-event`, etc.) but no styles exist for them yet. This story adds the CSS rules. All new selectors are scoped to `.ccp-grid*` so the existing list-view styles are not touched (FR-1.2).

## Acceptance criteria

- [ ] New CSS section appended to `src/rendering/styles.ts` (or in the static `styles` template literal of the appropriate Lit component) with comment marker `/* ===== Time-grid view ===== */`
- [ ] All new selectors prefixed with `.ccp-grid`:
  - `.ccp-grid` — flex column container (NO `overflow-y` — `.content-container` parent already provides scroll; nested scroll containers fight on touch)
  - `.ccp-grid-nav` — flex row, gap 4px, padding 4px 8px
  - `.ccp-grid-nav button` — transparent bg, no border, focus-visible outline using `--calendar-card-line-color-vertical`
  - `.ccp-grid-nav button[aria-disabled="true"]` — opacity 0.4, cursor not-allowed
  - `.ccp-grid-range` — margin-left auto (pushes label to right), uses `--calendar-card-font-size-event`
  - `.ccp-grid-headers, .ccp-grid-allday` — `display: grid` (template-columns set inline by renderer)
  - `.ccp-grid-body` — `display: grid; grid-template-columns: var(--calendar-card-grid-time-axis-width, 48px) 1fr` (this is what guarantees axis aligns with headers — F-1 fix from design doc v3 review)
  - `.ccp-grid-columns` — `display: grid` (template-columns set inline)
  - `.ccp-grid-day-column` — `position: relative; min-height: 24px; border-left: 1px solid var(--calendar-card-day-separator-color, transparent)`
  - `.ccp-grid-time-axis` — `position: relative; font-size: var(--calendar-card-font-size-time)` (hour labels positioned absolutely inside)
  - `.ccp-grid-allday` — `max-height: var(--calendar-card-grid-allday-max-height, 6em); overflow: hidden` (epic02 will fill content)
  - `.ccp-grid-event` — `position: absolute; border-inline-start: 2px solid var(--calendar-card-line-color-vertical); background: var(--calendar-card-line-color-vertical); border-radius: var(--calendar-card-grid-event-radius, 4px); font-size: var(--calendar-card-font-size-event); overflow: hidden`
  - `.ccp-grid-event.past-event` — `opacity: 0.55`
  - `.ccp-grid-hidden-pill` — `position: absolute; top: 2px; left: 2px; right: 2px; font-size: 10px; opacity: 0.7; text-align: center` (used by `+N hidden` indicator from FR-2.6)

- [ ] **`border-inline-start` (NOT `border-left`)** for the accent line — RTL-correct, matches existing list-view pattern at `render.ts`
- [ ] New CSS custom properties (with built-in fallbacks via `var(--name, default)`):
  - `--calendar-card-grid-time-axis-width` (default `48px`)
  - `--calendar-card-grid-event-radius` (default `4px`)
  - `--calendar-card-grid-allday-max-height` (default `6em`)
- [ ] These new vars are NOT added to `generateCustomPropertiesObject` (theme-only / card-mod-only; not user-configurable per FR-9.2 in design)
- [ ] `SLOT_HEIGHT_PX` is **NOT** a CSS variable — it's a code constant in `utils/grid.ts` consumed by the renderer for inline `top`/`height` values. This is intentional (avoids inconsistency between renderer / now-line / `getCardSize`)
- [ ] No existing CSS rule is modified (verify with `git diff upstream/dev -- src/rendering/styles.ts` — only additions, no deletions/changes to existing rules)

## Out of scope

- All-day banner inner styles (epic02 — banners use these CSS rules' container layout but add their own background-color via `styleMap`)
- Now-line styles (epic02 adds `.ccp-grid-now-line`)
- Editor styles (epic03 adds `.ccp-grid-allday-bg-opacity` related)

## Technical notes

- **`.ccp-grid-body` 2-column grid is the F-1 fix from design v3 review**: without `display: grid` on the body, time-axis and columns would stack as block-level siblings and not align with the headers' axis-prefix column.
- **No `--calendar-card-grid-slot-height` CSS variable**: this was attempted in earlier design drafts but rejected because it created an inconsistency risk between code paths (renderer / now-line / getCardSize). The constant lives only in code.
- **CSS class prefix `ccp-`**: this is the only `ccp-`-prefixed namespace in the codebase (existing CSS uses BEM-ish `event-`, `day-table`, etc.). New work picks `ccp-` to give card-mod users a clear hook; documented as intentional in design doc §6.6.
- **Card-mod compatibility**: card-mod can override `--calendar-card-grid-*` properties; per-event positioning via `styleMap` makes inline styles harder to override but matches the existing card pattern.

## Files touched

```
src/rendering/styles.ts      +~80 lines of CSS (new section, all .ccp-grid* selectors)
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean
- `npm run build` succeeds; bundle delta from CSS ~2 KB
- Manual smoke test: with `view: 'time-grid'` set, the grid actually looks like a calendar (events have backgrounds, accent borders, day columns are visible) — not just unstyled boxes
- Manual smoke test: list view unchanged
- Worklog entry created
- Commit message follows Conventional Commits (`style:` or `feat:` prefix)

## Mapping

- **Design doc**: §6.6 (CSS), FR-9.1, FR-9.2, FR-9.3
- **AGENTS.md**: Rule 5 (list view untouchable — verify CSS additions don't change existing rules)
