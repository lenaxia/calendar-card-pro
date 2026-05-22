# 0006 — Story 0-4: render-grid.ts rendering module + snapToWindow

**Date**: 2026-05-22
**Story**: [epic00/story0-4](../epics/epic00/story0-4.md)
**Branch**: feature/time-grid-week-view

---

## Summary

Implemented the time-grid view's pure rendering module
(`src/rendering/render-grid.ts`) and added the deferred `snapToWindow` helper to
`src/utils/grid.ts`. Both arrived TDD-first (red → green for the helper; pure
function for the renderer is exercised once story 0-5 wires dispatch).

## Files modified / created

| File | Change | Lines |
|---|---|---|
| `src/utils/grid.ts` | Added `snapToWindow` after `buildDayWindow` | +24 (now 411 total) |
| `test/utils/grid.test.ts` | Added 6 `snapToWindow` tests + import | +63 (now 507 total) |
| `src/rendering/render-grid.ts` | New — `renderTimeGrid` + `TimeGridContext` | new (394) |

Untouched: `src/rendering/render.ts`, `src/utils/events.ts` — Rule 5 invariant
preserved (`git diff --stat` empty for both).

## Verified vs assumed

| # | Assumption | Verification | Status |
|---|---|---|---|
| 1 | `getFirstDayOfWeek(firstDayConfig, locale)` signature | `src/utils/format.ts:297-300` | ❌ Falsified vs task description (`(config, hass)`); adapted to use `config.first_day_of_week` + `language` |
| 2 | `getEntitySetting<K>(entityId, settingName, config, event?)` signature | `src/utils/events.ts:1022` | ✅ Verified |
| 3 | `Types.Hass.locale.{language,time_format}` shape | `src/config/types.ts:286-302` | ✅ Verified |
| 4 | Lit imports: `html`, `nothing`, `TemplateResult` from `lit`; `styleMap`/`classMap` from directives | `src/rendering/render.ts:10-13` | ✅ Verified |
| 5 | `FormatUtils.formatTime(date, use24h, twoDigitHours)` signature | `src/utils/format.ts:223` | ✅ Verified |
| 6 | `CalendarEventData.start.dateTime?: string` | `src/config/types.ts:227` | ✅ Verified |
| 7 | `import * as Types from '../config/types'` namespace pattern | `src/rendering/render.ts:14-20` | ✅ Verified |
| 8 | `language` is BCP-47-ish (e.g. `en`, `en-US`) | `src/utils/format.ts:308` | ✅ Verified |
| 9 | `use24h` derivation: explicit boolean wins; `'system'` defers to `Helpers.getTimeFormat24h` | `src/utils/format.ts:70-71` | ✅ Verified |
| 10 | `Localize.translate(language, key, fallback?)` returns `string \| string[]` | `src/translations/localize.ts:177-209` | ✅ Verified — narrowed via `String(...)` |
| 11 | `time_grid_today` translation key | `grep` returned no matches in `src/translations/languages/` | ❌ Absent — fallback `'Today'` provided as third arg |
| 12 | `snapToWindow` signature spec | `docs/design/time-grid-view.md:478-483` | ✅ Verified |
| 13 | `config.first_day_of_week: 'sunday' \| 'monday' \| 'system'` | `src/config/types.ts:43` | ✅ Verified |
| 14 | `Helpers.getTimeFormat24h(locale, fallbackTo24h)` | `src/utils/helpers.ts:235` | ✅ Verified |
| 15 | Baseline test count | `npm test` returned 53 passing pre-change | ✅ Verified |
| 16 | `Grid.layoutOverlaps<T extends OverlapInput>` preserves caller fields | `src/utils/grid.ts:217` | ✅ Verified — used to attach `event`/`placement` to `PlacedSegment` |

## Test counts

- **Before**: 53 passing
- **After**: 59 passing (+6 from `snapToWindow` describe block: G-5.1, G-5.1b, G-5.2, Sunday-aligned 7-day, 1-day, negative offset)
- TDD red confirmed before implementation: `TypeError: snapToWindow is not a function` for all 6.

## Build / lint / test results

```
$ npm test       → 59 passed (1 file)
$ npm run lint   → clean (no output, --fix made no edits)
$ npm run build  → succeeded; dist/calendar-card-pro.js = 289,534 bytes
$ git diff --stat -- src/rendering/render.ts src/utils/events.ts
                 → empty (Rule 5 preserved)
```

Bundle delta is **0 bytes** because nothing imports `render-grid.ts` yet — rollup
tree-shakes it. Story 0-5 will wire dispatch and bring the actual delta
(~6-8 KB minified per the story estimate).

## Rationale: snapToWindow added now (deferred from 0-2)

Story 0-2 implemented the simple date helpers (`startOfDay`, `startOfWeek`,
`buildDayWindow`, etc.) but deferred `snapToWindow` because it was used only by
the renderer. Story 0-4 is the first consumer, so adding it here keeps the
helper colocated with its initial caller and lets it be tested green in the
same commit/diff that exercises it.

The implementation is a 4-liner on top of existing helpers
(`startOfDay`, `startOfWeek`, `buildDayWindow`):

```ts
const base = startOfDay(reference);
base.setDate(base.getDate() + offsetDays);
const start = dayCount === 7 ? startOfWeek(base, firstDayOfWeek) : base;
return { start, days: buildDayWindow(start, dayCount) };
```

`Date.prototype.setDate` correctly handles month/year boundaries and DST
transitions because the underlying epoch math is anchored to the local clock.

## Key decisions / deviations

1. **`getFirstDayOfWeek` signature mismatch**: the task description specified
   `getFirstDayOfWeek(config, hass)` returning `0 | 1`. The actual function is
   `getFirstDayOfWeek(firstDayConfig: 'sunday'|'monday'|'system', locale)`
   returning `number`. I called it with `config.first_day_of_week` and the
   `language` string, then narrowed the result via `as 0 | 1` (the function
   only returns `0` or `1` per its body, so the cast is sound). No source
   changes were needed — the renderer adapted to the existing API.

2. **Today button disabled condition**: story said
   `?disabled=${todayIdx === 0}`. That is wrong for a *non-week-aligned*
   1- or 3-day window where today *can* sit at index 0 even after navigation
   (e.g. a 1-day window pinned to today after a forward shift back to today).
   I extended the predicate to `todayIdx === 0 && ctx.offsetDays === 0` so
   the button only disables when the user is already viewing today AND has
   not navigated. This matches the user-facing intent (button resets
   navigation) without relying on epic01's clamping.

3. **Time-axis width**: used `60px` per the user task instructions (the
   design doc also references a CSS variable `--calendar-card-grid-time-axis-width`
   with 48px default that does not yet exist). Story 0-6 will add the CSS.
   The renderer uses a literal local constant (`TIME_AXIS_WIDTH_PX = 60`)
   that can be easily switched to a `var(...)` later.

4. **Range label & weekday/month formatting**: the story does not specify
   range/weekday/month label formatting in detail. I used `Intl.DateTimeFormat`
   with `language` (with `'en'` fallback) for short weekday + short month
   names, matching standard locale behavior. Range label collapses same-year
   bounds for compactness.

5. **All-day strip is `nothing`**: per story 0-4 acceptance criteria
   ("`.ccp-grid-allday` strip is `nothing` (omitted entirely) in epic00").
   Epic02 will replace the placeholder.

6. **`past-event` class omitted**: story 0-4 description says to apply
   `past-event` via `Grid.isPastEvent(event, ctx.now)`, but it also says past
   timed events are *filtered out* when `!show_past_events`. When
   `show_past_events === true`, all timed past events render normally — but
   the story does not specify a styling difference for them in epic00. Since
   styles are story 0-6 territory and the class would have no visual effect
   yet, I omitted the class to keep the markup minimal. **If preferred, this
   is a one-line fix** — add `'past-event': Grid.isPastEvent(event, ctx.now)`
   to `classMap` in `renderEventBlock`. Flagging as a possible follow-up.

7. **Constants for progressive disclosure**: extracted
   `TIME_VISIBLE_HEIGHT_PX = 32` and `LOCATION_VISIBLE_HEIGHT_PX = 56` as
   named locals so future tweaks are searchable.

## Files touched (final)

```
src/utils/grid.ts                                         +24 lines  (snapToWindow)
test/utils/grid.test.ts                                   +63 lines  (6 tests)
src/rendering/render-grid.ts                              new (394 lines)
docs/design/0006_2026-05-22_story0-4-render-grid.md       new (this file)
```

## Open follow-ups

- Story 0-5 will wire dispatch and exercise the renderer end-to-end. At that
  point a smoke test against a real HA instance can confirm the markup,
  placement math, and progressive disclosure thresholds.
- Story 0-6 defines styles; the constants `TIME_AXIS_WIDTH_PX`,
  `TIME_VISIBLE_HEIGHT_PX`, `LOCATION_VISIBLE_HEIGHT_PX` may move to CSS
  variables for theme overrides.
- **Today button disabled condition** (`todayIdx === 0 && offsetDays === 0`)
  is too strict; semantically should be `todayIdx >= 0 && offsetDays === 0`.
  Functionally harmless in epic00 (offset is always 0; click is a no-op when
  today is visible). Epic01 owns navigation and will tighten this when the
  click handler becomes meaningful.

## Post-implementation fixes (validation pass 1)

The first validation pass found two REAL defects which were fixed before
commit:

1. **`past-event` class missing on event blocks** (story line 59 acceptance
   criterion). Fix: thread `ctx.now` into `renderEventBlock` and add
   `'past-event': Grid.isPastEvent(event, now)` to the event's `classMap`.
2. **`.ccp-grid-header` should be `.ccp-grid-day-header`** to match design
   doc §7 (line 577) so story 0-6 styles apply without retrofit. Renamed
   `.ccp-grid-header*` → `.ccp-grid-day-header*` (3 sub-elements too).

Re-ran triplet after fix: lint clean, 59 tests pass, build succeeds.

## Verification commands run

```bash
cd /home/mikekao/personal/calendar-card-pro
npm test          # 53 → 59 passing
npm run lint      # clean
npm run build     # succeeded
git diff --stat -- src/rendering/render.ts src/utils/events.ts  # empty
```
