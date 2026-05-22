# Story 2-1 — All-Day Banner Placement + Overflow Indicators

**Epic**: [epic02 — All-Day Banners + Now-Line](README.md)
**Status**: Not started
**Estimate**: M (~half day)
**Depends on**: [epic01/story1-3](../epic01/story1-3.md) (`snapToWindow` window for `windowStart`), [epic00/story0-2](../epic00/story0-2.md) (`daysBetween` already exists)

---

## User story

> **As a** user with multi-day all-day events (vacations, holidays, conferences),
> **I want** them to render as horizontal banners across the day columns they cover,
> **So that** I can see at a glance which days are affected without scanning each column.
>
> **As the same user** when an event extends before or after the visible 7-day window,
> **I want** clear visual indicators (`◂` started before, `▸` continues after),
> **So that** I know to navigate to see the rest.

## Why this is needed

epic00 rendered `.ccp-grid-allday` as an empty placeholder. This story fills it with real banners. The math (`daysBetween`, clamping) was already implemented in epic00 story0-2; this story is the *consumer* of that math plus the rendering markup and the overflow-indicator strings.

## Acceptance criteria

- [ ] `src/config/types.ts` adds:
  ```ts
  time_grid_allday_bg_opacity: number;       // 0..1, default 0.2
  ```
  *(Note: `--calendar-card-grid-allday-max-height` is a CSS custom property only, not a config field. Card-mod / theme users can override; YAML users cannot. This matches design doc FR-9.2.)*
- [ ] `src/config/config.ts` adds matching `DEFAULT_CONFIG` entry
- [ ] `src/rendering/render-grid.ts` `renderTimeGrid` filters all-day events from `events` (`!event.start.dateTime && event.start.date`) and renders them in `.ccp-grid-allday`:
  ```ts
  // For each all-day event:
  const eventStartDay = FormatUtils.parseAllDayDate(event.start.date);  // local midnight
  const eventEndDay = FormatUtils.parseAllDayDate(event.end.date);      // iCal exclusive
  eventEndDay.setDate(eventEndDay.getDate() - 1);                       // inclusive last visible day

  const rawDayIdx = Grid.daysBetween(windowStart, eventStartDay);
  const dayIdx = Math.max(0, rawDayIdx);
  const clampOffset = Math.max(0, -rawDayIdx);
  const originalSpan = Grid.daysBetween(eventStartDay, eventEndDay) + 1;
  const numDays = Math.min(originalSpan - clampOffset, ctx.visibleDays - dayIdx);

  if (numDays <= 0) return nothing;  // defensive: malformed iCal where start === end

  const startedBefore = clampOffset > 0;
  const continuesAfter = (originalSpan - clampOffset) > (ctx.visibleDays - dayIdx);

  const accentBg = EventUtils.getEntityAccentColorWithOpacity(
    event._entityId,
    config,
    config.time_grid_allday_bg_opacity,
    event,   // 4th arg: pass event for _matchedConfig fast-path lookup; matches existing render.ts callsite pattern
  );

  return html`
    <div class="ccp-grid-allday-banner ${Grid.isPastEvent(event, ctx.now) ? 'past-event' : ''}"
         style=${styleMap({
           'grid-column-start': String(dayIdx + 2),
           'grid-column-end': `span ${numDays}`,
           'background-color': accentBg,
         })}>
      ${startedBefore ? html`<span class="ccp-grid-allday-overflow">◂</span>` : nothing}
      <span class="ccp-grid-allday-title">${event.summary}</span>
      ${continuesAfter ? html`<span class="ccp-grid-allday-overflow">▸</span>` : nothing}
    </div>
  `;
  ```
- [ ] All-day events sorted: primary by `eventStartDay` ASC, secondary by `originalSpan` DESC (longer banners stack first → simpler events nest visually)
- [ ] When the visible window has zero all-day events, the strip is omitted (`html`...`` returns nothing for the strip wrapper or just emits an empty `<div>` collapsed by `max-height` + `overflow:hidden`). FR-6.3.
- [ ] `src/rendering/styles.ts` adds:
  ```css
  .ccp-grid-allday {
    /* (existing rules from epic00 story0-6) */
    max-height: var(--calendar-card-grid-allday-max-height, 6em);
    overflow: hidden;
  }
  .ccp-grid-allday-banner {
    border-radius: var(--calendar-card-grid-event-radius, 4px);
    padding: 2px 6px;
    margin: 1px;
    border-inline-start: 2px solid var(--calendar-card-line-color-vertical);
    color: var(--calendar-card-color-event);
    font-size: var(--calendar-card-font-size-event);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .ccp-grid-allday-banner.past-event { opacity: 0.55; }
  .ccp-grid-allday-overflow { opacity: 0.6; margin: 0 4px; }
  ```
- [ ] **`--calendar-card-grid-allday-max-height` is a CSS custom property only**, NOT bound to a config field. Default `6em` is built into the CSS rule's `var()` fallback. Users who want to customize do so via card-mod or theme CSS variables.
- [ ] Test: spec G-2.7a (banner fully within window), G-2.7b (clipped at start, `◂`), G-2.7c (clipped at end, `▸`), G-2.7d (spans entire window, both indicators)
  - These test the placement math in pure helper form. Extract `computeBannerPlacement(eventStart, eventEnd, windowStart, visibleDays)` to `utils/grid.ts` if not already there.
- [ ] `show_past_events: false` does **NOT** filter all-day past events (FR-2.11 / G-pastEventsFilter). They render with `past-event` class for dimming.

## Out of scope

- "+N more" chip when banner strip overflows max-height (deferred per stakeholder decision; `overflow: hidden` clips silently for v1)
- Click handlers on banners (deferred)
- Weather icons in banners (deferred)

## Technical notes

- **`getEntityAccentColorWithOpacity`** is an existing utility in `events.ts` — reuse it; don't roll your own
- **`isPastEvent` from `utils/grid.ts`** (epic00 story0-2) handles all-day-event past detection correctly (uses iCal end-exclusive adjustment internally per `render.ts:803-830`)
- **CSS Grid placement: `grid-column-start: <dayIdx + 2>`** because column 1 is the time-axis spacer; day columns start at column 2. This was verified in design v6 review.
- **Multiple banners on the same day**: CSS Grid auto-flow places non-overlapping banners in row 1 of the strip; overlapping (multi-day spans that intersect) auto-flow to row 2, etc. With `max-height: 6em` (~96px) and ~28px per banner row, ~3 rows fit before clipping.
- **Empty strip**: if no banners are emitted, the `<div class="ccp-grid-allday">` collapses to 0 height (no children + grid container). Acceptable.

## Files touched

```
src/config/types.ts                  +1 field (time_grid_allday_bg_opacity only)
src/config/config.ts                 +1 DEFAULT_CONFIG entry
src/rendering/render-grid.ts         banner rendering (~50 lines)
src/rendering/styles.ts              banner-specific CSS (~25 lines)
src/utils/grid.ts                    optionally +computeBannerPlacement (~15 lines)
test/utils/grid.test.ts              optionally +G-2.7a/b/c/d cases (~40 lines)
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean
- `npm test` passes (G-2.7a-d if banner placement extracted; otherwise manual verification)
- `npm run build` succeeds; bundle delta this story ~3-4 KB
- Manual smoke test:
  - Multi-day event spans correct columns
  - Single-day all-day event renders in 1 column
  - Event starting before window → `◂` indicator
  - Event ending after window → `▸` indicator
  - Past all-day event (e.g., yesterday's holiday) → dimmed via `past-event` class even with `show_past_events: false`
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` prefix)

## Mapping

- **Design doc**: §6.4 (renderer markup), §6.6 (CSS), FR-2.7, FR-2.11, FR-6.1, FR-6.2, FR-6.3
- **Acceptance specs**: G-2.7a/b/c/d, G-pastEventsFilter (all-day half)
- **AGENTS.md**: Rule 1 (verify `parseAllDayDate` returns local midnight by reading `format.ts`), Rule 5 (banner code is in `render-grid.ts`, NOT `render.ts`)
