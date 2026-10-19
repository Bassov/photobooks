# Proposal

## Why

**Problem:** Roadmap items already cite `UI ref: uikit#/feature/<slug>`, but the kit exists only as an external zip — agents and PRs cannot open the reference in-repo.

**Why now:** M2.5 design foundation; owner decision 2026-10-19 lands the whole UI kit v3.1 in one PR today.

## What Changes

- Import kit `source/` (sha256-verified zip) as workspace package `uikit/` (no `package-lock.json`; deps in root lockfile), including `scripts/`, all 77 pages, photos + `PHOTO-CREDITS.md`.
- Serve the kit at `/uikit/` in `pnpm dev` and in the preview build as its own Vite bundle (never in the app main bundle); CI asserts app assets contain no uikit modules; `pnpm deps` fails on `src/**` → `uikit/` imports.
- CI workflow job `uikit` (typecheck + build + `qa:quick`); `uikit/README.md` documents run + `UI ref` convention; `uikit/**` stays outside coverage/mutation file sets and outside the size limit (owner decision).

## Scope

**In:** `uikit/` package, root workspace/lockfile wiring, `/uikit/` serve path, isolation gates, `uikit` CI workflow, README.

**Out:** App restyle onto kit tokens/primitives; `docs/design.md`; screenshot baselines; consuming kit from `src/**`; editing parallel-session files (stryker-diff-gate, lessons-dissolve, book-titles, asset-metadata-extract).

## Capabilities

### New Capabilities

_(none — packaging/tooling prep; `skip_specs: true`)_

### Modified Capabilities

_(none)_

## Success criteria

- All 77 feature pages open at `/uikit/` in the preview build with no console errors in Light and Dark.
- App main bundle has no uikit modules; coverage and mutation include/exclude sets unchanged.
- `pnpm deps` fails if `src/**` imports from `uikit/`; `pnpm audit:ci` passes on the new lockfile.

## Risks

- New kit dependencies (Tailwind 4, fontsource, lucide, etc.) expand the supply chain — mitigate with `audit:ci` + dependency-review + Security Review before archive.
- Large `uikit/**` diff — expected; excluded from size limit (owner decision).
- Serving `/uikit/` must not pull kit modules into the app Rollup graph — separate Vite project + CI string/module assertion.

## Impact

New `uikit/` workspace package; root `pnpm-workspace.yaml` + lockfile; minimal root `package.json` `uikit:*` scripts and build/dev wiring; new `.github/workflows/uikit.yml`; depcruise rule; optional size-exclusion hook when that script exists. No product `src/**` behavior change.
