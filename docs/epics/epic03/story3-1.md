# Story 3-1 — Visual Editor: View Selector + Time-Grid Expansion Panel

**Epic**: [epic03 — Editor + Localization + Documentation](README.md)
**Status**: Not started
**Estimate**: M (~half day; lots of small editor field additions)
**Depends on**: [epic02](../epic02/README.md) (all config fields exist)

---

## User story

> **As a** user who configures HA cards through the visual editor (not YAML),
> **I want** the time-grid view to be a one-click option with all its tunables exposed in a clear "Time grid" section,
> **So that** I can use the feature without learning YAML or reading the design doc.

## Why this is needed

Today the time-grid view is YAML-only. This story adds a `view` selector to Core Settings and a new "Time grid" expansion panel revealed when `view: 'time-grid'` is selected. The list-view fields (`days_to_show`, `compact_*`) are hidden when grid view is active because they don't apply.

## Acceptance criteria

- [ ] `src/rendering/editor.ts` adds a "View" dropdown inside the Core Settings expansion panel (near `start_date_mode`):
  ```ts
  ${this.addSelectField(
    'view',
    this._getTranslation('view'),
    [
      { value: 'list', label: this._getTranslation('view_list') },
      { value: 'time-grid', label: this._getTranslation('view_time_grid') },
    ],
  )}
  ```
- [ ] `days_to_show` (and helper-text) wrapped in conditional, hidden when `view: 'time-grid'`:
  ```ts
  ${this.getConfigValue('view') !== 'time-grid'
    ? html`
        ${this.addTextField('days_to_show', this._getTranslation('days_to_show'), 'number')}
        <div class="helper-text">${this._getTranslation('days_to_show_note')}</div>
      `
    : nothing}
  ```
- [ ] `compact_events_to_show`, `compact_days_to_show`, `compact_events_complete_days`, `show_empty_days`, `show_week_numbers` — wrap each in the same `view !== 'time-grid'` conditional. (These are all list-view concepts.)
- [ ] New "Time grid" expansion panel, revealed only when `view === 'time-grid'`:
  ```ts
  ${this.getConfigValue('view') === 'time-grid'
    ? this.addExpansionPanel(
        this._getTranslation('time_grid_settings'),
        mdiViewWeek,  // or another fitting MDI icon
        html`
          ${this.addTextField('time_grid_start_hour', this._getTranslation('time_grid_start_hour'), 'number')}
          ${this.addTextField('time_grid_end_hour', this._getTranslation('time_grid_end_hour'), 'number')}
          ${this.addSelectField(
            'time_grid_interval_minutes',
            this._getTranslation('time_grid_interval_minutes'),
            [
              { value: 15, label: '15' },
              { value: 30, label: '30' },
              { value: 60, label: '60' },
            ],
          )}
          ${this.addTextField('time_grid_event_min_height_px', this._getTranslation('time_grid_event_min_height_px'), 'number')}
          ${this.addSelectField(
            'time_grid_max_days',
            this._getTranslation('time_grid_max_days'),
            [
              { value: 1, label: '1' },
              { value: 3, label: '3' },
              { value: 7, label: '7' },
            ],
          )}
          ${this.addTextField('time_grid_navigation_days', this._getTranslation('time_grid_navigation_days'), 'number')}
          ${this._renderNavigationDaysHint()}   // FR-7.6 — see below
          ${this.addTextField('time_grid_breakpoint_three_day_px', this._getTranslation('time_grid_breakpoint_three_day_px'), 'number')}
          ${this.addTextField('time_grid_breakpoint_seven_day_px', this._getTranslation('time_grid_breakpoint_seven_day_px'), 'number')}
          ${this.addBooleanField('time_grid_show_now_line', this._getTranslation('time_grid_show_now_line'))}
          ${this.addTextField('time_grid_allday_bg_opacity', this._getTranslation('time_grid_allday_bg_opacity'), 'number')}
        `,
      )
    : nothing}
  ```
- [ ] Helper-text hint when `time_grid_navigation_days < time_grid_max_days` (FR-7.6):
  ```ts
  private _renderNavigationDaysHint() {
    const navDays = this.getConfigValue('time_grid_navigation_days') as number;
    const maxDays = this.getConfigValue('time_grid_max_days') as number;
    if (navDays < maxDays) {
      return html`
        <div class="helper-text helper-text-warning">
          ${this._getTranslation('time_grid_navigation_days_warning')}
        </div>
      `;
    }
    return nothing;
  }
  ```
- [ ] Editor's reactive update behavior verified: changing the view selector instantly toggles the panel visibility (Lit auto-detects `_config` change via `_fireConfigChanged` → `this._config = ...` → reactive prop change → re-render); no explicit `requestUpdate()` needed
- [ ] When user toggles `view` and saves, `filterDefaultValues` correctly omits unchanged grid fields from YAML — verified by manual smoke test (open editor, toggle to time-grid, change just one field, save, view YAML; only the changed field + `view: 'time-grid'` appear)
- [ ] All editor strings come from `_getTranslation(key)`; no hardcoded English strings (story3-2 adds the keys)

## Out of scope

- Translation values themselves — story3-2
- Documentation strings in README — story3-3

## Technical notes

- **`addSelectField`, `addTextField`, `addBooleanField`, `addExpansionPanel`** are existing helpers (verified in design doc A17). They take `(path, label, options/type)`.
- **`getConfigValue('path')`** supports dot notation, but we don't use dot notation here (all flat scalars).
- **MDI icon for the panel**: `mdiViewWeek`, `mdiCalendarWeek`, or `mdiTableLarge` — pick one that fits visually with the existing card icons (existing panels use `mdiCalendarMonth`, `mdiPalette`, `mdiCog`).
- **Validation in editor**: not added in this story. The host's `setConfig` (epic00 story0-3) coerces invalid values to defaults with `Logger.warn`. The editor inputs are number-typed, so HTML validation prevents non-numeric input naturally; range validation happens on save.
- **`helper-text-warning` CSS class**: may not exist in current `styles.ts`; either add (light yellow background, dark text) or use existing `helper-text` (looks the same — just plain helper text).

## Files touched

```
src/rendering/editor.ts          editor changes (~80 lines)
src/rendering/styles.ts          optionally +helper-text-warning style (~5 lines)
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean
- `npm run build` succeeds; bundle delta this story ~2 KB
- Manual smoke test:
  - Open editor → see View dropdown
  - Switch to Time grid → list-view fields hide, "Time grid" panel appears
  - Edit a field, save → only that field + `view: 'time-grid'` saved to YAML
  - Set `time_grid_navigation_days = 5, time_grid_max_days = 7` → warning hint appears
  - Switch back to List → grid panel hides, list fields reappear
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` prefix)

## Mapping

- **Design doc**: §6.5 (FR-7.7 conditional pattern), §6.7 (editor design), FR-7.1 through FR-7.7
- **AGENTS.md**: Rule 1 (verify `addSelectField` signature by reading `editor.ts` directly), Rule 2 (don't claim "the helper handles validation" without verifying)
