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

- [ ] **Pure math extracted to `src/utils/grid.ts:computeCardSize(config)`** so it can be unit-tested without instantiating the LitElement host:
  ```ts
  // In utils/grid.ts:
  export function computeCardSize(config: Pick<Types.Config,
    'view' | 'time_grid_start_hour' | 'time_grid_end_hour' |
    'time_grid_interval_minutes' | 'max_height'>): number {
    if (config.view !== 'time-grid') return 1;  // list view: HA documented default

    const slotsPerHour = 60 / config.time_grid_interval_minutes;
    const gridPx = (config.time_grid_end_hour - config.time_grid_start_hour)
                 * slotsPerHour * SLOT_HEIGHT_PX;
    const chromePx = 80;  // nav header + day headers (approximation)
    let totalPx = gridPx + chromePx;

    // Best-effort clamp to max_height if it's a px value
    const mh = config.max_height;
    if (mh && mh !== 'none' && mh.endsWith('px')) {
      const mhPx = parseFloat(mh);
      if (!isNaN(mhPx)) totalPx = Math.min(totalPx, mhPx);
    }

    return Math.max(1, Math.ceil(totalPx / 50));
  }
  ```
- [ ] `src/calendar-card-pro.ts` adds a public `getCardSize()` method that just delegates to the helper:
  ```ts
  public getCardSize(): number {
    return Grid.computeCardSize(this.config);
  }
  ```
- [ ] Returns `1` for `view: 'list'` — matches HA's documented default ("A card size of `1` will be assumed if the method is not defined") and is explicit/idiomatic. List view masonry-mode behavior is unchanged.
- [ ] Returns `Math.ceil((gridPx + 80) / 50)` for `view: 'time-grid'`, clamped if `max_height` is a px value
- [ ] Test cases (in `test/utils/grid.test.ts` — testing the pure helper, not the host method):
  - `view: 'list'` → `1`
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
- **Why list view returns `1` (not `undefined`)**: HA docs state "A card size of `1` will be assumed if the method is not defined" — returning `1` makes the behavior explicit and idiomatic. Per AGENTS.md Rule 5, list-view masonry distribution is unchanged from "method not defined" because `1` IS the implied default.
- **Why `computeCardSize` is in `utils/grid.ts`, not the host**: pure math; testable without instantiating LitElement; consistent with where the rest of the grid math lives.
- **`SLOT_HEIGHT_PX`** comes from `src/utils/grid.ts` (story0-2). Don't hardcode `24` here — that would create the inconsistency we explicitly avoided.

## Files touched

```
src/utils/grid.ts                         +computeCardSize helper (~15 lines)
src/calendar-card-pro.ts                  +getCardSize method (~3 lines, delegates to helper)
test/utils/grid.test.ts                   +4 test cases
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
