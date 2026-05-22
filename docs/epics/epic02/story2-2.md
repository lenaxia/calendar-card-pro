# Story 2-2 — Now-Line Rendering + 60-Second Imperative Position Update

**Epic**: [epic02 — All-Day Banners + Now-Line](README.md)
**Status**: Not started
**Estimate**: M (~half day)
**Depends on**: [epic01/story1-3](../epic01/story1-3.md) (renderer knows `todayIdx`)

---

## User story

> **As a** user looking at the time-grid view during the workday,
> **I want** a clear horizontal line on today's column showing the current time,
> **So that** I can see at a glance how far along I am in the day and what's coming up next.

## Why this is needed

This is a frequently-requested feature ([#325](https://github.com/alexpfau/calendar-card-pro/issues/325) "Vertical Day View 'Live' indicator Line"). The implementation matters: a naive approach (reactive prop ticking every minute → full Lit re-render) wastes work. We use **imperative DOM mutation** of a single element's `style.top` so the rest of the grid is untouched.

## Acceptance criteria

- [ ] `src/rendering/render-grid.ts` emits the now-line element ONLY in today's column AND only when `config.time_grid_show_now_line` is true:
  ```ts
  // Inside the day-column markup loop:
  ${i === todayIdx && config.time_grid_show_now_line
    ? html`<div class="ccp-grid-now-line"></div>`
    : nothing}
  ```
  *Note: `time_grid_show_now_line` was added to schema in epic00 story0-3; this story consumes it.*
- [ ] `src/rendering/styles.ts` adds:
  ```css
  .ccp-grid-now-line {
    position: absolute;
    left: 0; right: 0;        /* positioning context: parent .ccp-grid-day-column */
    height: 2px;
    background: var(--calendar-card-grid-now-line-color, var(--calendar-card-line-color-vertical));
    pointer-events: none;
    z-index: 1;
  }
  ```
- [ ] `src/calendar-card-pro.ts` adds private fields:
  ```ts
  private _nowLineIntervalId?: number;
  private _lastRenderDay: number = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();   // initialized at construction; avoids spurious first-tick requestUpdate
  ```
- [ ] New private methods:
  ```ts
  private _startNowLine(): void {
    if (this._nowLineIntervalId !== undefined) return;
    this._updateNowLinePosition();   // immediate
    this._nowLineIntervalId = window.setInterval(
      () => this._updateNowLinePosition(),
      60_000,
    );
  }

  private _stopNowLine(): void {
    if (this._nowLineIntervalId !== undefined) {
      clearInterval(this._nowLineIntervalId);
      this._nowLineIntervalId = undefined;
    }
  }

  private _updateNowLinePosition(): void {
    // (1) Midnight detection — runs FIRST, before lineEl null-guard. (Story 2-3 implements this.)
    // For this story: just the position update.

    // (2) Position update via pure helper Grid.computeNowLineTop
    const lineEl = this.renderRoot.querySelector<HTMLElement>(
      '.ccp-grid-day-column.today .ccp-grid-now-line',
    );
    if (!lineEl) return;  // today not visible OR view is not time-grid OR show_now_line is false

    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const top = Grid.computeNowLineTop(
      minutes,
      this.config.time_grid_start_hour * 60,
      this.config.time_grid_end_hour * 60,
      Grid.SLOT_HEIGHT_PX,
      this.config.time_grid_interval_minutes,
    );

    if (top === null) {
      lineEl.style.display = 'none';
      return;
    }

    lineEl.style.display = '';
    lineEl.style.top = `${top}px`;
  }
  ```
- [ ] `connectedCallback` (after the existing logic from epic01):
  ```ts
  if (this.config.view === 'time-grid' && this.config.time_grid_show_now_line) {
    this._startNowLine();
  }
  ```
- [ ] `disconnectedCallback`: `this._stopNowLine();`
- [ ] `updated(changedProps)` — when view changes into time-grid, start the interval; when out of time-grid, stop:
  ```ts
  if (changedProps.has('config')) {
    const prevConfig = changedProps.get('config') as Types.Config | undefined;
    if (prevConfig?.view !== this.config.view) {
      this._stopNowLine();
      if (this.config.view === 'time-grid' && this.config.time_grid_show_now_line) {
        this._startNowLine();
      }
    }
    // Also handle time_grid_show_now_line toggle:
    else if (prevConfig?.time_grid_show_now_line !== this.config.time_grid_show_now_line) {
      this._stopNowLine();
      if (this.config.view === 'time-grid' && this.config.time_grid_show_now_line) {
        this._startNowLine();
      }
    }
  }
  ```
- [ ] `_handleVisibilityChange` extended (story2-3 will add the `'hidden'` branch; for now this story keeps the interval running while card is connected, regardless of visibility — story2-3 fixes that)
- [ ] Test: spec G-2.10 — position math
  ```
  GIVEN now=14:30 local, gridStartMin=360 (06:00), slot=24, interval=30
  WHEN _updateNowLinePosition computes top
  THEN top === '408px'  (= (870-360)/30*24)
  ```
  Implementation: extract the position formula to `utils/grid.ts:computeNowLineTop(minutes, gridStartMin, gridEndMin, slotHeightPx, intervalMin): number | null` (returns null for out-of-range). Test as a pure function.
- [ ] Test: spec G-2.10b — out-of-range hides
  ```
  GIVEN now=23:30, gridStartMin=360, gridEndMin=1320 (06-22)
  WHEN computeNowLineTop is called
  THEN result === null  (renderer/host translates to display:none)
  ```

## Out of scope

- Midnight refresh — story2-3
- Visibility-change pause — story2-3
- Stop/start interval based on whether today is currently in view (deferred per epic-level out-of-scope)

## Technical notes

- **Why imperative not reactive**: a reactive `nowTick` prop would trigger a full Lit re-render of all events every 60s. The now-line is a single 2px DOM node — mutating its `style.top` directly costs ~0 ns vs ~ms for a full re-render with 50 events.
- **Why query inside `today` column**: positioning context is the `.ccp-grid-day-column.today` element (since it's `position: relative`). `left: 0; right: 0` then spans only that column's width. This is the design v3-C-4 fix; design v3 had the line at body level which spanned all columns.
- **`renderRoot.querySelector` not `this.querySelector`**: Lit components use shadow DOM (or a `renderRoot`); `this.querySelector` would search outside.
- **`_lastRenderDay` initial value**: setting it to today's midnight at construction time means the first `_updateNowLinePosition` tick won't trigger a spurious `requestUpdate`. (Story 2-3 implements the midnight check; this story just sets up the field.)
- **Interval is 60_000ms** — minute granularity is enough for a 2px line.

## Files touched

```
src/rendering/render-grid.ts        +now-line emit (~5 lines)
src/rendering/styles.ts             +now-line CSS (~8 lines)
src/calendar-card-pro.ts            +interval lifecycle (~50 lines)
src/utils/grid.ts                   +computeNowLineTop (~10 lines)
test/utils/grid.test.ts             +G-2.10/2.10b cases (~15 lines)
```

## Definition of done

- All acceptance criteria checked
- `npm run lint` clean
- `npm test` passes (G-2.10/2.10b)
- `npm run build` succeeds
- Manual smoke test:
  - Now-line visible on today's column at the correct vertical position
  - Wait 1 minute → line moves down (verify by watching it; or change system clock)
  - Set `time_grid_show_now_line: false` → line disappears, interval stops (verify in DevTools no setInterval)
  - Toggle `view: list` → line not present (no day columns); interval stops
- Worklog entry created
- Commit message follows Conventional Commits (`feat:` prefix)

## Mapping

- **Design doc**: §6.5 (`_updateNowLinePosition` + `_startNowLine`/`_stopNowLine`), FR-2.10, FR-11.4
- **Acceptance specs**: G-2.10, G-2.10b
- **AGENTS.md**: Rule 1 (verify `renderRoot` vs `this` query target by reading Lit docs), Rule 7 (no inline comments restating code in the new methods)
