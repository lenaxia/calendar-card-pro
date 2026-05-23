# Epic 03 — Editor + Localization + Documentation

**Status**: Not started
**Source issue**: [alexpfau/calendar-card-pro#300](https://github.com/alexpfau/calendar-card-pro/issues/300)
**Design doc**: [`docs/design/time-grid-view.md`](../../design/time-grid-view.md)
**Depends on**: [epic00](../epic00/README.md), [epic01](../epic01/README.md), [epic02](../epic02/README.md)

---

## Why this epic exists

epics 00-02 ship a working time-grid view, but it's only configurable via YAML. This epic makes it accessible to users who use the **visual editor**, surfaces the new strings in **English translations** (the fallback language), and updates user-facing **documentation** so contributors and end-users know the feature exists and how to use it.

After this epic, the feature is "ship-ready":

- Visual editor users can switch views and tune grid options without YAML
- A new user reading the README sees the time-grid view documented
- `docs/architecture.md` reflects the new module layout

## In scope

- Visual editor: View selector (List / Time grid) in Core Settings
- Visual editor: "Time grid" expansion panel (revealed when `view: 'time-grid'`) with all `time_grid_*` fields
- Visual editor: Hides `days_to_show` and `compact_*` fields when `view: 'time-grid'` (per FR-7.7)
- Visual editor: Helper-text hint when `time_grid_navigation_days < time_grid_max_days` (FR-7.6)
- Translations: English keys added to `src/translations/languages/en.json` for all new editor labels and 5 navigation aria/label strings
- Translations: Other 32 languages get English fallback automatically (per `localize.ts:166`); other-language updates are follow-up PRs
- README: New `### Time-grid view` section with example config, screenshot (placeholder OK if real screenshot deferred), and option reference
- `docs/architecture.md`: Updated directory tree to reflect `src/utils/grid.ts`, `src/rendering/render-grid.ts`

## Out of scope (deferred)

- Translations to non-English languages (separate PRs per language; English fallback is sufficient per design doc §10)
- Visual screenshot generation (placeholder OK; real screenshot can be added in a separate doc PR)
- HACS card preview / `getStubConfig` updates (per design doc OQ-6, separate PR)

## User-facing outcome

After this epic, a user who installs calendar-card-pro and adds it to a dashboard via the UI:

1. Picks "Calendar Card Pro" from the card picker
2. In the editor, sees a "View" dropdown in Core Settings → picks "Time grid"
3. A "Time grid" expansion panel appears below with all the new options (start/end hour, interval, navigation days, breakpoints, etc.)
4. `days_to_show` and compact-mode fields are hidden (they're list-view-specific)
5. Saves; sees the grid view rendered without ever editing YAML

## Stories

| #                       | Title                                                     | Status      |
| ----------------------- | --------------------------------------------------------- | ----------- |
| [story3-1](story3-1.md) | Visual editor — view selector + Time-grid expansion panel | Not started |
| [story3-2](story3-2.md) | English translations for editor labels + nav aria strings | Not started |
| [story3-3](story3-3.md) | README + architecture.md updates                          | Not started |

## Acceptance for the epic as a whole

- All stories complete with their acceptance criteria met
- `npm run lint` clean
- `npm run build` succeeds; cumulative bundle delta (epic00–03) ≤ +25 KB minified (cap raised in worklog 0020)
- Manual smoke test 1: visual editor shows view selector; toggling view shows/hides the right panels
- Manual smoke test 2: toggling between views and saving produces minimal YAML (no spurious defaults)
- Manual smoke test 3: setting `time_grid_navigation_days = 5` while `time_grid_max_days = 7` shows a warning hint in the editor
- Manual smoke test 4: opening the card in another language (e.g., German) shows English editor labels (fallback works)
- README has a Time-grid view section that explains how to enable it

## Dependencies

- epic00, epic01, epic02 — needs all the config fields and behavior to exist before exposing them in the editor
- Translation strings only make sense once the navigation buttons (epic01) and now-line toggle (epic02) exist

## Blocks

- Nothing internal — this epic is the final "polish + ship" step
- Releases follow this epic

## Mapping to design doc FRs

| FR                  | Story    | Notes                                  |
| ------------------- | -------- | -------------------------------------- |
| FR-7.1              | story3-1 | View selector                          |
| FR-7.2              | story3-1 | Time grid expansion panel + fields     |
| FR-7.3              | story3-1 | Conditional reveal via `requestUpdate` |
| FR-7.4              | story3-1 | `filterDefaultValues` minimal YAML     |
| FR-7.5              | story3-1 | Editor labels via translations         |
| FR-7.6              | story3-1 | Helper-text hint                       |
| FR-7.7              | story3-1 | Hide `days_to_show` etc.               |
| FR-8.1              | story3-2 | New strings list                       |
| FR-8.2              | story3-2 | English fallback                       |
| Documentation tasks | story3-3 | README, architecture.md                |
