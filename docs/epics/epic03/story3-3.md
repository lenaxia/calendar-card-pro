# Story 3-3 — README + `architecture.md` Updates

**Epic**: [epic03 — Editor + Localization + Documentation](README.md)
**Status**: Not started
**Estimate**: S (~1-2 hours; doc-only)
**Depends on**: All earlier epic03 stories (so docs reflect what's actually shipped)

---

## User story

> **As a** new user evaluating calendar-card-pro,
> **I want** to read the README and learn that a time-grid view exists, with example config and a screenshot,
> **So that** I can decide whether to install the card and how to enable the feature.
>
> **As a** future contributor,
> **I want** `docs/architecture.md` to reflect the current module layout (including `src/utils/grid.ts` and `src/rendering/render-grid.ts`),
> **So that** I can find my way around the codebase.

## Why this is needed

After epics 00-02 ship the feature and epic03 stories 1-2 expose it via the editor + translations, the documentation is the last polish step. Without README updates, users who haven't been following the issue won't know the feature exists. Without `architecture.md` updates, the directory tree shown in the doc is wrong.

This story is the **final commit before opening the upstream PR.**

## Acceptance criteria

- [ ] `README.md` adds a new section `### Time-Grid View` placed under **"5️⃣ Features & Configuration"**, after the existing "Layout & Appearance" subsection (so it sits naturally with other view-related features). The section briefly explains the feature with one example config and a screenshot, but does NOT duplicate the full options table — those belong in section 6.

  Structure (~30-40 lines):
  ```markdown
  ### 🕒 Time-Grid View

  A Google-Calendar–style view that places timed events on a 2-D plane:
  vertical = time of day, horizontal = days. Responsive: 1 column on mobile,
  3 on tablet, 7 on desktop (configurable breakpoints).

  Enable it with `view: time-grid`:

  ```yaml
  type: custom:calendar-card-pro
  entities: [calendar.work, calendar.personal]
  view: time-grid
  time_grid_navigation_days: 28
  ```

  ![Time-grid view screenshot](docs/images/time-grid-view.png)

  **Navigation**: `<<` `<` `Today` `>` `>>` buttons let you scroll forward/backward.
  At 7-day width, `<` `>` are hidden (window snaps to weeks). At 1-day width,
  `<<` `>>` are hidden.

  **Notes:**
  - `view: 'time-grid'` is independent of `days_to_show`. Grid uses
    `time_grid_navigation_days`; `days_to_show` only applies to list view.
  - Events display in the browser's local timezone, not Home Assistant's.
  - All-day events render as banners across the top.
  - `tap_action: 'expand'` is a no-op in grid view.

  See section 6 below for the full list of `time_grid_*` configuration options.
  ```
- [ ] Screenshot file: a placeholder is acceptable for the PR (e.g., `docs/images/time-grid-view.png` could be a simple text "Screenshot pending" PNG, or omit the image line if no placeholder works in markdown). A real screenshot can be added in a follow-up doc PR. **Don't block this story on a perfect screenshot.**
- [ ] **`README.md` section 6 (Configuration Variables) gets a new section row** for time-grid options. The existing table has section markers like `**Core Settings**`, `**Layout and Spacing**`, `**Today Indicator**`, etc. Add a new section marker `**Time-Grid View**` with rows for each new field:
  ```markdown
  | **Time-Grid View**                         |                   |                                                    |                                                                                                                                |
  | `view`                                     | string            | `list`                                             | View mode: `list` (default) or `time-grid` (Google-Calendar-style)                                                             |
  | `time_grid_start_hour`                     | number            | `6`                                                | First hour on the time axis (0-23)                                                                                             |
  | `time_grid_end_hour`                       | number            | `22`                                               | Last hour on the time axis (1-24, must be > start)                                                                             |
  | `time_grid_interval_minutes`               | number            | `30`                                               | Slot interval — allowed: 15, 30, 60                                                                                            |
  | `time_grid_event_min_height_px`            | number            | `24`                                               | Minimum event block height in pixels                                                                                           |
  | `time_grid_max_days`                       | number            | `7`                                                | Max visible columns — allowed: 1, 3, 7                                                                                         |
  | `time_grid_navigation_days`                | number            | `28`                                               | Days of events fetched for grid view (independent of `days_to_show`)                                                           |
  | `time_grid_breakpoint_three_day_px`        | number            | `500`                                              | Width below which 1-column view is used                                                                                        |
  | `time_grid_breakpoint_seven_day_px`        | number            | `900`                                              | Width above which 7-column view is used                                                                                        |
  | `time_grid_show_now_line`                  | boolean           | `true`                                             | Show a live "current time" line on today's column                                                                              |
  | `time_grid_allday_bg_opacity`              | number            | `0.2`                                              | Opacity of all-day banner backgrounds (0-1)                                                                                    |
  ```
  Insert after the `**Cache and Refresh**` section in the existing table to keep it as the last new section.
- [ ] `docs/architecture.md` directory tree updated to include:
  ```
  src/
  ├── utils/
  │   ├── grid.ts          (NEW) — pure helpers: date math, event placement, overlap layout
  │   └── ...
  ├── rendering/
  │   ├── render-grid.ts   (NEW) — time-grid view render functions
  │   └── ...
  ```
- [ ] `docs/architecture.md` adds a brief paragraph (~5-8 lines) describing the time-grid view's data flow at the same level of detail as the existing list-view description
- [ ] No changes to `CONTRIBUTING.md` (process is unchanged)
- [ ] `docs/RELEASE_NOTES.md` updated with the new feature under the appropriate version heading (likely a new "Unreleased" or next-version section)

## Out of scope

- Real screenshot generation (deferred to a follow-up doc PR)
- Migration guide / "upgrading from v3.x" notes (no breaking changes — all new fields are optional with defaults)
- Translation of the README to other languages (project doesn't have translated READMEs today)

## Technical notes

- **Don't break existing README sections**: read the current README structure first; insert the new section in a location that flows with the existing narrative. If the README is structured by topic ("Configuration", "Examples", etc.) rather than by view type, adapt accordingly.
- **Markdown table formatting**: existing README probably uses pipe-tables; match indent/alignment.
- **Screenshot path convention**: existing card images may live in `docs/images/`, `assets/`, or referenced from the wiki. Match the existing pattern.

## Files touched

```
README.md                            +Time-grid view section (~70 lines)
docs/architecture.md                 +grid.ts + render-grid.ts in tree, +flow paragraph (~15 lines)
docs/images/time-grid-view.png       new (placeholder OK; real screenshot in follow-up)
docs/RELEASE_NOTES.md                +entry under Unreleased / next version (~10 lines)
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean (markdown isn't linted by ESLint, but Prettier may format JSON — irrelevant here)
- `npm run build` still succeeds (no code changes, but verify no unintended side effects)
- Manual visual check: README renders correctly on GitHub (preview the PR description)
- Manual visual check: `architecture.md` directory tree displays cleanly
- Worklog entry created — this is the **final worklog of the feature branch** before PR submission
- Commit message follows Conventional Commits (`docs:` prefix)

## Mapping

- **Design doc**: §13 Definition of done items 6 (architecture.md) and 7 (README) and 8 (PR description)
- **AGENTS.md**: Rule 1 (verify directory tree against actual filesystem before writing it down)

## After this story

The feature branch is ready for:

1. **Self-review** of the entire diff against `upstream/dev` (one final lookahead pass)
2. **PR submission**: `gh pr create --base alexpfau/calendar-card-pro:dev` with the description referencing #300, #14, #239, #282, #325 with the addresses/partially-addresses mapping per design doc §13
