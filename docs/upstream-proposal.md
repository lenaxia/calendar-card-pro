# Feature Proposal: Time-Grid View (Google Calendar-style)

## Summary

I've implemented a time-grid view for Calendar Card Pro that displays events in a vertical time-axis layout (similar to Google Calendar's day/week view). It's fully working on my fork and I'd like to discuss whether this is something you'd consider merging upstream.

**Fork with working implementation:** https://github.com/lenaxia/calendar-card-pro/tree/feature/time-grid-week-view
**Latest pre-release for testing:** https://github.com/lenaxia/calendar-card-pro/releases/tag/v3.3.0-rc15

## Motivation

The existing list view is great for a compact overview, but for time-based planning (seeing gaps, overlaps, and how the day is structured), a time-grid layout is much more intuitive. This is the #1 feature I wanted when I started using Calendar Card Pro.

## What it does

```yaml
type: custom:calendar-card-pro
entities:
  - calendar.personal
  - calendar.work
view: time-grid
```

### Features implemented:
- **1/3/7 day columns** — auto-responsive based on card width (configurable breakpoints)
- **Configurable time axis** — start/end hour, 30-min slot resolution
- **Per-entity colors** — each calendar gets its own accent color (border + translucent background)
- **Overlap handling** — overlapping events render side-by-side in lanes
- **Navigation** — ‹/› day buttons, «/» window buttons, "Today" button, swipe gestures with animation
- **Now line** — current time indicator, updates every 60s, pauses when tab/card not visible
- **Auto-scroll** — scrolls to current time on load
- **Event detail popup** — click any event to see time, location, description; copy-to-clipboard for location
- **All-day banners** — rendered above the time grid with overflow indicators (◂/▸)
- **Weather integration** — daily weather in day column headers (uses existing weather config)
- **Alternating row backgrounds** — subtle hour-boundary lines for visual alignment
- **Swipe navigation** — with slide animation feedback
- **Text selection** — can select/copy text from events
- **Past event dimming** — consistent with list view behavior

### Screenshots

*(I can add screenshots if you're interested in seeing the current state)*

## Technical approach

- **Pure render function** — `renderTimeGrid()` is a pure function of (events, config, context) → TemplateResult. No DOM access, no clock reads.
- **Two new utility modules** — `src/utils/grid.ts` (date math, placement, overlap layout) and `src/rendering/render-grid.ts` (Lit templates)
- **Two Lit 3 ReactiveControllers** — `NowLineController` (clock tick) and `ResponsiveColumnsController` (ResizeObserver for auto-column-count)
- **List view untouched** — `render.ts` has a 5-line change (new `isGridView` param on `renderMainCardStructure`). `events.ts` has 8 lines changed (exported one function). The list view is byte-for-byte identical in behavior.
- **215 tests** — covering grid math, placement, overlap layout, event splitting, navigation clamping, controllers
- **~14KB bundle increase** (332KB total, from 300KB)

## Config additions

| Variable | Default | Description |
|----------|---------|-------------|
| `view` | `list` | `list` or `time-grid` |
| `time_grid_start_hour` | `6` | First visible hour |
| `time_grid_end_hour` | `22` | Last visible hour |
| `time_grid_interval_minutes` | `30` | Slot interval |
| `time_grid_event_min_height_px` | `24` | Min event block height |
| `time_grid_show_now_line` | `true` | Current-time indicator |
| `time_grid_max_days` | `7` | Max columns |
| `time_grid_breakpoint_three_day_px` | `500` | Width for 3-col |
| `time_grid_breakpoint_seven_day_px` | `900` | Width for 7-col |
| `time_grid_navigation_days` | `28` | Navigable range |

## Questions for you

1. **Is this a feature you'd want in the project?** I know it's a significant addition and may not align with your vision for the card.
2. **If yes, what would you need from me?** I'm happy to:
   - Squash into clean logical commits
   - Rebase onto `dev`
   - Add/modify tests per your preferences
   - Adjust the architecture if you have concerns
   - Add editor UI support for the new settings
3. **Any concerns about the approach?** The implementation deliberately avoids modifying existing list-view code paths to minimize risk.

Happy to discuss any aspect of the implementation. The fork is fully functional if you want to try it out via HACS (point to `lenaxia/calendar-card-pro`).
