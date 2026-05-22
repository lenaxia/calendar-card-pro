# Story 0-7 — `getCardSize()` for Masonry View

**Epic**: [epic00 — Time-Grid Base View](README.md)
**Status**: Not started
**Estimate**: S (small — ~30 min)
**Depends on**: [story0-3](story0-3.md) (uses config fields)

---

## User story

> **As a** Home Assistant user with a masonry-mode dashboard,
> **I want** the time-grid card to occupy the right number of rows in the masonry layout (~17 rows for default 06–22 grid),
> **So that** other cards stack around it correctly without overlapping or leaving big gaps.

## Why this is needed

Without `getCardSize()`, HA's masonry view defaults to size `1` (~50px), which causes the grid to overlap neighboring cards or be visually clipped. Section view (HA's grid mode) is unaffected — it gives the card full width and natural height by default. So this story matters specifically for masonry layouts.

This story is small but should be a separate commit because it's the only host change in epic00 that's not part of story0-5's render dispatch.

## Acceptance criteria

- [ ] `src/calendar-card-pro.ts` adds a public `getCardSize()` method:
  ```ts
  public getCardSize(): number {
    if (this.config.view === 'time-grid') {
      const slotsPerHour = 60 / this.config.time_grid_interval_minutes;
      const slotPx = Grid.SLOT_HEIGHT_PX;  // = 24
      const gridPx = (this.config.time_grid_end_hour - this.config.time_grid_start_hour)
                   * slotsPerHour * slotPx;
      const chromePx = 80;  // nav header + day headers (approximation)
      let totalPx = gridPx + chromePx;

      // Best-effort clamp to max_height if it's a px value
      const mh = this.config.max_height;
      if (mh && mh !== 'none' && mh.endsWith('px')) {
        const mhPx = parseFloat(mh);
        if (!isNaN(mhPx)) totalPx = Math.min(totalPx, mhPx);
      }

      return Math.max(1, Math.ceil(totalPx / 50));
    }
    return 3;  // existing default-ish for list view
  }
  ```
- [ ] Returns `3` for `view: 'list'` (matches the implicit default behavior for the existing list view, which doesn't have `getCardSize` today — adding `3` is a small UX improvement)
- [ ] Returns `Math.ceil((gridPx + 80) / 50)` for `view: 'time-grid'`, clamped if `max_height` is a px value
- [ ] Test cases (in `test/utils/getCardSize.test.ts` or co-located in `grid.test.ts`):
  - `view: 'list'` → `3`
  - `view: 'time-grid', start=6, end=22, interval=30` → `17` (= `ceil((16*2*24 + 80)/50) = ceil(848/50)`)
  - same + `max_height='400px'` → `8` (= `ceil(400/50)`)
  - `view: 'time-grid', start=0, end=24, interval=60` → `14` (= `ceil((24*1*24 + 80)/50) = ceil(656/50)`)
- [ ] No `getGridOptions()` is added (deliberate per FR-10.2; HA's section view defaults work fine without it)

## Out of scope

- `getGridOptions()` for HA section view (intentional — defaults are fine)
- Pixel-perfect sizing including all-day strip (epic02 might revisit; for now strip height is part of `chromePx` approximation)
- Handling non-px `max_height` values (`50vh`, `calc(...)` etc.) — best-effort px clamp only

## Technical notes

- **Why `chromePx = 80`**: nav header ~40px + day headers ~40px (approximation; actual depends on font sizes set by user). Off-by-a-few-rows is acceptable since `getCardSize` is itself approximate per HA docs.
- **Why `max_height` clamp**: if user explicitly sets `max_height: '400px'` and the grid would be 848px, masonry should allocate 8 rows (400/50), not 17 (848/50). Without clamp, masonry over-allocates.
- **Why no list view `getCardSize` until now**: existing card has no `getCardSize`; defaults to size 1 in masonry. This story adds `3` for list view as a small improvement at no extra cost.
- **`SLOT_HEIGHT_PX`** comes from `src/utils/grid.ts` (story0-2). Don't hardcode `24` here — that would create the inconsistency we explicitly avoided.

## Files touched

```
src/calendar-card-pro.ts                  +1 method (~20 lines)
test/utils/grid.test.ts (or new file)     +4 test cases
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean
- `npm test` passes including the 4 new cases
- `npm run build` succeeds
- Manual smoke test: card placed in masonry-view dashboard with `view: 'time-grid'` (default 06-22 / interval 30) — no overlap with neighboring cards; row allocation looks reasonable (~17 rows ≈ 850px)
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` prefix)

## Mapping

- **Design doc**: FR-10.1, §6.5 (`getCardSize` snippet)
- **Acceptance specs**: G-getCardSize (4 cases)
- **AGENTS.md**: Rule 1 (verify the math; G-getCardSize numerical assertions are the ground truth)
