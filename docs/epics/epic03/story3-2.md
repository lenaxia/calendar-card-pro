# Story 3-2 — English Translations for Editor Labels + Nav Aria Strings

**Epic**: [epic03 — Editor + Localization + Documentation](README.md)
**Status**: Not started
**Estimate**: S (~1-2 hours; mostly mechanical)
**Depends on**: [story3-1](story3-1.md) (editor uses `_getTranslation` keys)

---

## User story

> **As a** user with HA's UI in any language,
> **I want** the time-grid editor labels and navigation buttons to be readable (in English if not in my language),
> **So that** I can configure the feature even before translators add my language.
>
> **As a** screen-reader user,
> **I want** the navigation buttons to have proper aria-labels,
> **So that** I can navigate the calendar without sighted access.

## Why this is needed

Story3-1 added `_getTranslation('view_time_grid')`, `_getTranslation('time_grid_start_hour')`, etc. — but those translation keys don't exist yet in `en.json`. This story populates them. English is the fallback language per `localize.ts:166`, so adding keys here makes the editor work in all languages immediately (with English text where the local language hasn't been translated yet).

## Acceptance criteria

- [ ] `src/translations/languages/en.json` adds the following keys under the appropriate sections:
  ```json
  {
    "editor": {
      "view": "View",
      "view_list": "List",
      "view_time_grid": "Time grid",

      "time_grid_settings": "Time grid",
      "time_grid_start_hour": "Start hour",
      "time_grid_end_hour": "End hour",
      "time_grid_interval_minutes": "Slot interval (minutes)",
      "time_grid_interval_minutes_note": "Allowed values: 15, 30, 60",
      "time_grid_event_min_height_px": "Minimum event height (px)",
      "time_grid_max_days": "Maximum visible days",
      "time_grid_max_days_note": "Allowed values: 1, 3, 7",
      "time_grid_navigation_days": "Navigation window (days)",
      "time_grid_navigation_days_warning": "Navigation window is smaller than maximum visible days. Consider increasing it.",
      "time_grid_breakpoint_three_day_px": "Three-day breakpoint (px)",
      "time_grid_breakpoint_seven_day_px": "Seven-day breakpoint (px)",
      "time_grid_show_now_line": "Show 'now' line",
      "time_grid_allday_bg_opacity": "All-day banner opacity (0–1)"
    },
    "time_grid_today": "Today",
    "time_grid_prev_day_aria": "Previous day",
    "time_grid_next_day_aria": "Next day",
    "time_grid_prev_window_aria": "Previous {n} days",
    "time_grid_next_window_aria": "Next {n} days"
  }
  ```
- [ ] The 5 navigation strings (`time_grid_today`, `time_grid_prev_day_aria`, etc.) live at the **top level** of `en.json` (not under `editor`) because they're user-facing UI strings, not editor-only labels. Verify by reading `localize.ts` for the existing pattern (e.g., `noEvents`, `errorMessage` are top-level).
- [ ] Templated strings like `time_grid_prev_window_aria: "Previous {n} days"` use `{n}` placeholder. **The existing `Localize.translate(lang, key, fallback)` does NOT do interpolation** (verified by reading `localize.ts:177-209`). The renderer must do `.replace('{n}', String(visibleDays))` at the call site:
  ```ts
  // In render-grid.ts:
  const t = (key: string) => Localize.translate(language, key, key) as string;
  const ariaPrev = t('time_grid_prev_window_aria').replace('{n}', String(visibleDays));
  ```
  Alternative considered: add `{n}` interpolation to `Localize.translate`. Rejected — adds shared infra for one use case.
- [ ] `src/rendering/render-grid.ts` updated so navigation buttons consume the translated strings:
  ```ts
  const t = (key: string) => Localize.translate(language, key, key);
  // ...
  <button aria-label="${t('time_grid_prev_window_aria').replace('{n}', String(visibleDays))}"
          @click=${...}>
    «
  </button>
  ```
- [ ] Other 32 language files NOT modified in this story (English fallback handles it; per-language updates are follow-up PRs as design doc §10.3 says)

## Out of scope

- Other-language translations (separate PRs per language)
- Visual editor regression testing in non-English locales (manual smoke test sufficient: confirm German `de.json` doesn't have these keys, the editor still renders English labels — proves fallback works)
- A11y testing with actual screen readers (manual best-effort)

## Technical notes

- **English is the fallback language**: `localize.ts:getTranslations(lang)` falls back to `'en'` when `lang` is not loaded. `translate(lang, key, fallback)` returns the raw value or the key itself; for `editor.*` keys, `editor.ts:344-358` has `hasEditorTranslations(lang)` to fall through to English when the language has no editor block.
- **`{n}` interpolation**: check existing `en.json` for templated strings. If the project uses a placeholder system (`{count}`, `{day}`, etc.), match it. If not, use simple `.replace('{n}', String(n))` at the call site.
- **Top-level vs `editor.*`**: editor-specific strings (form labels, panel titles) go under `editor`. User-facing UI strings (button labels, error messages, "Today") go at top level. Verified pattern: `noEvents`, `errorMessage` are top-level; `editor.days_to_show`, `editor.start_date_mode` are nested.
- **JSON formatting**: existing `en.json` uses 2-space indent and double quotes. Match exactly.

## Files touched

```
src/translations/languages/en.json    +18 keys (organized: 14 editor.* + 5 top-level)
src/rendering/render-grid.ts          +translation lookups in nav header (~5 lines)
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean (Prettier may reformat the JSON; that's fine)
- `npm run build` succeeds
- Manual smoke test 1 — English: editor labels are present and readable; nav buttons announce correctly with screen reader
- Manual smoke test 2 — Non-English: switch HA UI language to e.g. German; open editor → English labels still appear (fallback works)
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` or `i18n:` prefix)

## Mapping

- **Design doc**: FR-7.5, FR-8.1, FR-8.2
- **AGENTS.md**: Rule 1 (verify the existing fallback chain by reading `localize.ts:160-209`)
