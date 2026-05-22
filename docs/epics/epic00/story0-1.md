# Story 0-1 — Vitest Test Scaffolding

**Epic**: [epic00 — Time-Grid Base View](README.md)
**Status**: Not started
**Estimate**: S (small — config-only, ~30 min)

---

## User story

> **As a** contributor adding pure helpers for the time-grid feature,
> **I want** a working Vitest scaffold with `npm test` and `npm run test:watch`,
> **So that** I can write tests *before* implementation (TDD per AGENTS.md Rule 8) and have CI catch regressions.

## Why this is needed

The repo currently has **no test framework**. Per the design doc §10, time-grid pure helpers (date math, overlap layout, banner placement) are non-trivial enough that they justify Vitest as a dev dependency. This story sets up the scaffold so subsequent stories can write tests.

## Acceptance criteria

- [ ] `vitest` added to `devDependencies` in `package.json` (single new dep; pinned version, e.g. `^2.1.0`)
- [ ] `npm test` script runs `vitest run` (one-shot) and exits 0 with no tests
- [ ] `npm run test:watch` script runs `vitest` (watch mode)
- [ ] `tsconfig.json` either unchanged OR augmented with a `vitest`-compatible config block (no `noEmit: false` toggle — esbuild still owns the build)
- [ ] `eslint.config.mjs` does not reject test files (verify by running `npm run lint`)
- [ ] An empty test file `test/utils/grid.test.ts` exists with `import { describe, it, expect } from 'vitest';` and a single placeholder `describe.skip('grid', () => { it('TODO', () => { expect(1).toBe(1); }); });`
- [ ] `npm run build` continues to pass (no impact on production bundle)
- [ ] No existing test files in `src/` are touched

## Out of scope

- Writing actual tests (story0-2)
- Adding a CI job for `npm test` (deferred — design doc §10.3 says this is a follow-up)
- Coverage tooling (`@vitest/coverage-v8` etc.)
- jsdom or HA stubs for editor/component tests (deferred per design doc §10)

## Technical notes

- Vitest is Vite-native and ESM-friendly; uses esbuild internally — matches the project's existing toolchain
- No `vitest.config.ts` should be needed for pure-helper tests (defaults work)
- File location: tests live in `test/` (not co-located with source) — matches design doc §10.1 layout
- The placeholder test exists only to verify the runner works; story0-2 deletes/replaces it

## Files touched

```
package.json                 +2 devDeps line, +2 scripts
test/utils/grid.test.ts      new (placeholder)
package-lock.json            regenerated
```

## Definition of done

- All acceptance criteria checked
- `npm install`, `npm run lint`, `npm run build`, `npm test` all pass locally
- Worklog entry created (NNNN_YYYY-MM-DD_*.md format per AGENTS.md Rule 0)
- Commit message follows Conventional Commits style (`build:` or `test:` prefix)

## Mapping

- **Design doc**: §10.3 (tooling additions), §12 phase 1
- **AGENTS.md**: Rule 8 (TDD where practical)
