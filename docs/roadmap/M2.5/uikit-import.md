# uikit-import

Tag: prep
Milestone: M2.5
Title: UI kit v3.1 in the repo as the UI/UX reference (whole kit, one step)

## Scope

- [ ] Import the whole kit from `/mnt/c/Users/Aleks/agent-loop/uikit/photobooks-ui-kit-v3.1.zip` (sha256 601cf5b7c6ae682e9a839f0c9c7587194c8505c401def67d6ec072d957d1a458; take `source/`, including its `scripts/` qa and shots scripts, all 77 pages, photos with `PHOTO-CREDITS.md`) as a separate workspace package `uikit/` with its own `package.json`, Vite config and `tsconfig`; kit dependencies go into the root `pnpm-lock.yaml` (no `package-lock.json`) and pass `audit:ci` + dependency-review.
- [ ] Own Vite entry/page served at `/uikit/` in dev and in the preview build as a separate bundle, never in the app's main bundle: CI asserts the app bundle contains no `uikit/` modules, and `pnpm deps` fails when `src/**` imports from `uikit/`.
- [ ] `uikit/**` is outside coverage and mutation (it is outside `src/**`; the reviewer verifies the coverage and mutation file sets are unchanged) and is excluded from `diff-size-check` (owner decision 2026-10-19: not app code). When `exclusions-registry` / `diff-size-check` land, they register `uikit/**` (separate-package category / size exclusion).
- [ ] CI job `uikit`: typecheck + build + `qa:quick`; `uikit/README.md`: what the kit is, how to run it, how roadmap items point to it (`UI ref: uikit#/feature/<slug>`), `docs/roadmap.md` stays the source of truth.
- **Done when:** all 77 pages open at `/uikit/` in the preview build with no console errors in both themes, the app's main bundle is unchanged (no uikit modules), and the coverage and mutation file sets are unchanged.
- **Size:** whole kit in one PR; `uikit/**` excluded from the size limit (owner decision 2026-10-19)
- **Source:** owner decision 2026-10-19 (one item, separate /uikit/ page)
