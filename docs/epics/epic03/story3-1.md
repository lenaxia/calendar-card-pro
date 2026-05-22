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

- [ ] `src/rendering/editor.ts` adds a "View" dropdown inside the Core Settings expansion panel (near `start_date_mode`). The select uses **string values** (matches existing `first_day_of_week`, `time_24h` patterns):
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
- [ ] **List-view sections that don't apply to grid view are wrapped as whole sections (with their `<h3>` headers and helper-text)**, not individual fields. The existing editor structure at `editor.ts:687-712` has two such sections:

  **"Compact Mode" section** — wrap entirely (does not apply to grid view):
  ```ts
  ${this.getConfigValue('view') !== 'time-grid'
    ? html`
        <h3>${this._getTranslation('compact_mode')}</h3>
        <div class="helper-text">${this._getTranslation('compact_mode_note')}</div>
        ${this.addTextField('compact_days_to_show', this._getTranslation('compact_days_to_show'), 'number')}
        ${this.addTextField('compact_events_to_show', this._getTranslation('compact_events_to_show'), 'number')}
        ${this.addBooleanField('compact_events_complete_days', this._getTranslation('compact_events_complete_days'))}
        <div class="helper-text">${this._getTranslation('compact_events_complete_days_note')}</div>
      `
    : nothing}
  ```

  **"Event Visibility" section** — wrap PARTIALLY. `show_past_events` and `filter_duplicates` apply to grid view too (FR-2.11). Only `show_empty_days` is list-only:
  ```ts
  <h3>${this._getTranslation('event_visibility')}</h3>
  ${this.addBooleanField('show_past_events', this._getTranslation('show_past_events'))}
  ${this.getConfigValue('view') !== 'time-grid'
    ? html`${this.addBooleanField('show_empty_days', this._getTranslation('show_empty_days'))}`
    : nothing}
  ${this.addBooleanField('filter_duplicates', this._getTranslation('filter_duplicates'))}
  ```

  **`days_to_show` (and helper-text)** — wrap together as before:
  ```ts
  ${this.getConfigValue('view') !== 'time-grid'
    ? html`
        ${this.addTextField('days_to_show', this._getTranslation('days_to_show'), 'number')}
        <div class="helper-text">${this._getTranslation('days_to_show_note')}</div>
      `
    : nothing}
  ```

  **`show_week_numbers`** — wrap as a single field (it's not in a `<h3>` section but in the "Week Numbers" subsection). Defer; not part of this story.
- [ ] New "Time grid" expansion panel, revealed only when `view === 'time-grid'`. **All numeric fields use `addTextField` with `type='number'` (NOT `addSelectField`)** because:
  - `addSelectField` `options` is typed `Array<{value: string; label: string}>` — TypeScript rejects numeric values
  - `_valueChanged` already handles `type='number'` via `parseFloat` (editor.ts:449-452)
  - This avoids hand-coding numeric conversion special cases (like the existing `time_24h` workaround in `setConfigValue`)

  ```ts
  ${this.getConfigValue('view') === 'time-grid'
    ? this.addExpansionPanel(
        this._getTranslation('time_grid_settings'),
        mdiViewWeek,  // or another fitting MDI icon
        html`
          ${this.addTextField('time_grid_start_hour', this._getTranslation('time_grid_start_hour'), 'number')}
          ${this.addTextField('time_grid_end_hour', this._getTranslation('time_grid_end_hour'), 'number')}
          ${this.addTextField('time_grid_interval_minutes', this._getTranslation('time_grid_interval_minutes'), 'number')}
          <div class="helper-text">${this._getTranslation('time_grid_interval_minutes_note')}</div>
          ${this.addTextField('time_grid_event_min_height_px', this._getTranslation('time_grid_event_min_height_px'), 'number')}
          ${this.addTextField('time_grid_max_days', this._getTranslation('time_grid_max_days'), 'number')}
          <div class="helper-text">${this._getTranslation('time_grid_max_days_note')}</div>
          ${this.addTextField('time_grid_navigation_days', this._getTranslation('time_grid_navigation_days'), 'number')}
          ${this._renderNavigationDaysHint()}   // FR-7.6 — see below
          ${this.addTextField('time_grid_breakpoint_three_day_px', this._getTranslation('time_grid_breakpoint_three_day_px'), 'number')}
          ${this.addTextField('time_grid_breakpoint_seven_day_px', this._getTranslation('time_grid_breakpoint_seven_day_px'), 'number')}
          ${this.addBooleanField('time_grid_show_now_line', this._getTranslation('time_grid_show_now_line'))}
          ${this.addTextField('time_grid_allday_bg_opacity', this._getTranslation('time_grid_allday_bg_opacity'), 'number')}
        `,
        false,    // 4th arg: expandedByDefault — collapsed by default to keep editor compact
      )
    : nothing}
  ```
  The `_note` helper-text strings (e.g. `time_grid_interval_minutes_note: "Allowed values: 15, 30, 60"`) compensate for not using a select dropdown by guiding users on accepted values. Validation already happens in `setConfig` (epic00 story0-3) — invalid values are coerced to defaults with a `Logger.warn`.
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

- **`addSelectField`, `addTextField`, `addBooleanField`, `addExpansionPanel`** are existing helpers (verified in editor.ts). Signatures:
  - `addSelectField(name, label, options: Array<{value: string; label: string}>, clearable?, defaultValue?, changeCallback?)` — values are **strings only**. Use `addTextField(... 'number')` for numeric fields.
  - `addTextField(name, label?, type?, defaultValue?)` — `type` defaults to `'text'`; pass `'number'` for numeric inputs (handled by `_valueChanged` at editor.ts:449-452 via `parseFloat`). Optional 4th `defaultValue` arg is rarely needed because `getConfigValue(name)` returns the merged default-config value. Skip the 4th arg unless you specifically want a different fallback in the input box than the merged config value.
  - `addBooleanField(name, label)` — uses `ha-switch`; values handled at editor.ts:445-447.
  - `addExpansionPanel(title, icon, content, expandedByDefault?)` — 4th arg is optional boolean, default `false`.
- **`getConfigValue('path')`** supports dot notation, but we don't use dot notation here (all flat scalars).
- **MDI icon for the panel**: `mdiViewWeek`, `mdiCalendarWeek`, or `mdiTableLarge` — pick one that fits visually with the existing card icons (existing panels use `mdiCalendarMonth`, `mdiPalette`, `mdiCog`).
- **Conditional reveal pattern**: mirrors the existing `start_date_mode` pattern at `editor.ts:572` (`_handleStartDateModeChange`). Lit auto re-renders when `_config` changes via `_valueChanged → setConfigValue → _fireConfigChanged → this._config = mergedConfig` (reactive prop). No explicit `requestUpdate()` needed for our case (same as `start_date_mode`'s simple toggle).
- **Validation**: not added in editor. The host's `setConfig` (epic00 story0-3) coerces invalid values to defaults with `Logger.warn`. The editor inputs are number-typed, so HTML validation prevents non-numeric input naturally; range validation happens on save via `setConfig`.
- **`helper-text-warning` CSS class**: may not exist in current `styles.ts`. Either add a new class (light-yellow background, dark text) OR reuse plain `helper-text`. Recommend reusing `helper-text` to keep the style minimal.

## Files touched

```
src/rendering/editor.ts          editor changes (~80 lines added inside Core Settings + new Time-grid panel)
```

(no changes to `setConfigValue` needed — `addTextField` with `type='number'` covers numeric handling already)

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
