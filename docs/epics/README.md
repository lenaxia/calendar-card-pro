# Epics & Stories — calendar-card-pro

This directory tracks user-story-level work for active features. Each epic has a `README.md` (the epic definition) and one `storyN-M.md` per story.

## Format

```
docs/epics/
├── README.md                 (this file)
├── epic00/
│   ├── README.md             epic 00 definition
│   ├── story0-1.md           story 1 of epic 0
│   ├── story0-2.md
│   └── ...
├── epic01/
│   ├── README.md
│   ├── story1-1.md
│   └── ...
└── epicNN/
    ├── README.md
    └── storyN-M.md
```

**Story file naming**: `storyN-M.md` where `N` is the epic number (zero-padded to match folder name) and `M` is the story number within the epic (1-indexed). Examples:
- `epic00/story0-1.md` — first story of epic 00
- `epic01/story1-3.md` — third story of epic 01

## Active epics

| # | Title | Source issues | Status |
|---|---|---|---|
| [epic00](epic00/README.md) | Time-Grid Base View | [#300](https://github.com/alexpfau/calendar-card-pro/issues/300), [#14](https://github.com/alexpfau/calendar-card-pro/issues/14) | Not started |
| [epic01](epic01/README.md) | Responsive Columns + Navigation | [#300](https://github.com/alexpfau/calendar-card-pro/issues/300), [#185](https://github.com/alexpfau/calendar-card-pro/issues/185) | Not started |
| [epic02](epic02/README.md) | All-Day Banners + Now-Line | [#282](https://github.com/alexpfau/calendar-card-pro/issues/282), [#325](https://github.com/alexpfau/calendar-card-pro/issues/325) | Not started |
| [epic03](epic03/README.md) | Editor + Localization + Documentation | [#300](https://github.com/alexpfau/calendar-card-pro/issues/300) | Not started |

## Epic dependency graph

```
epic00 (base view)
   ↓
epic01 (responsive + nav) ──┐
   ↓                         │
epic02 (all-day + now-line) ─┤
                              ↓
                          epic03 (editor + i18n + docs)
                              ↓
                        PR to upstream/dev
```

## Story status legend

- **Not started** — no commits yet
- **In progress** — branch has commits, but acceptance criteria not all met
- **Ready for review** — all acceptance criteria met, awaiting human review
- **Done** — merged or accepted

## Relationship to other docs

- **`docs/design/time-grid-view.md`** — the authoritative design doc (v13). Stories reference its FR numbers and acceptance specs. When the design and a story conflict, fix the story or the design (don't silently diverge).
- **`AGENTS.md`** — the rules an agent must follow when implementing a story. Story acceptance criteria assume agents follow `AGENTS.md`.
- **`docs/design/NNNN_YYYY-MM-DD_*.md`** — worklogs. One per story (or per significant work session within a story). Per `AGENTS.md` Rule 0, no story is done without a worklog.

## When to add an epic

A new epic is justified when:

1. The work spans multiple files **and** multiple commits
2. The work has its own acceptance criteria distinct from a parent feature
3. Splitting it from existing epics improves PR review (smaller, focused diffs)

For tiny work (single-file changes, typo fixes, dependency bumps), skip the epics structure entirely and just commit + worklog.

## When to add a story

Within an epic, add a story when:

1. The work is a coherent unit deliverable in one PR commit (or small commit series)
2. It has its own acceptance criteria
3. It can be verified independently (smoke test, unit test, or `git diff` check)

Aim for stories that take **half a day to a day** of focused work. Stories taking >2 days should usually be split. Stories taking <1 hour can often be merged with adjacent stories.
