# Design

## Context

Zip `photobooks-ui-kit-v3.1.zip` (sha256 `601cf5b7…d1a458`) contains `site/` (prebuilt — do not commit) and `source/` (Vite+React package `0.3.1`, 77 pages, qa/shots scripts, photos). Repo is a single package today; no workspace. App Vite builds to `dist/`; Wrangler serves `dist/` as SPA. Coverage/mutation only include `src/**` (+ listed scripts). `scripts/check-diff-size.mjs` is optional and not present yet. Parallel sessions own other files — do not touch them.

## Goals / Non-Goals

**Goals:**

- Whole kit as `uikit/` workspace package on the root lockfile.
- `/uikit/` in dev and preview build; separate Rollup graph from the app.
- Isolation: depcruise + CI bundle assertion; coverage/mutation sets unchanged; size exclusion for `uikit/**`.
- CI job `uikit` + `uikit/README.md`.

**Non-Goals:**

- Restyling the app; writing `docs/design.md`; screenshot baselines.
- Committing `site/`; keeping kit `package-lock.json`.
- Editing existing `integration.yml` / `checks.yml` except a small app-bundle assertion step if it must live on the app build artifact.

## Decisions

1. **Import path** — Copy only `source/**` (+ root `PHOTO-CREDITS.md` / kit README content) into `uikit/`. Delete kit `package-lock.json`. Add `pnpm-workspace.yaml` with `packages: ['uikit']`. Root `package.json` gains thin `uikit:*` scripts (`--filter photobooks-ui-kit`).

2. **Serve `/uikit/` (one subsystem: kit Vite project)** — Kit keeps its own `vite.config.ts` with `base: '/uikit/'` and `build.outDir: '../dist/uikit'` (IIFE + relative assets as upstream). Root `pnpm build` runs app Vite then kit build into `dist/uikit/`. Dev: root Vite plugin mounts kit Vite in `middlewareMode` under `/uikit` so one `pnpm dev` serves both without merging graphs. Preview: `vite preview` / Wrangler see `dist/uikit/index.html`.

3. **Isolation gates** — `.dependency-cruiser.cjs` adds `src-no-uikit` (`from: ^src/` → `to: (^uikit/|photobooks-ui-kit)`). New `scripts/assert-no-uikit-in-app-bundle.mjs` (unit-tested) after app build: scan `dist/assets/**` (exclude `dist/uikit/**`) for path/module markers (`uikit/`, `photobooks-ui-kit`). Wire into `checks.yml` Build section (needs app `dist/`); kit CI stays in new `.github/workflows/uikit.yml`.

4. **Tooling boundaries** — Root ESLint/knip/tsconfig stay on `src/**` (+ scripts/e2e); add `uikit/**` to ESLint ignores and Prettier ignore so kit style is untouched. Coverage `include`/`exclude` and Stryker `mutate` unchanged (prove in PR body via `git diff origin/main -- vite.config.ts stryker.config.mjs`).

5. **Size exclusion** — If `scripts/check-diff-size.mjs` is absent, document owner exclusion in `uikit/README.md` + PR body; when that script exists or is added here, exclude `uikit/**`. Prefer a tiny allowlist file read by the size script over editing parallel gate files.

6. **Done-when proof** — Run kit against preview URL `/uikit/` (not only `file://`): build → preview → drive all 77 pages in Light + Dark; record console-error count in tasks Manual scenarios / PR body. `qa:quick` remains the CI smoke (file:// on kit dist); preview proof is the Manual check.

7. **UI lock-ins (prep kit surface)** — Observable UX locked as:
   - **Empty:** kit index at `/uikit/` (or `/uikit/#/`) lists groups/pages; search empty-state clearable.
   - **Happy:** open one representative feature URL, e.g. `/uikit/#/feature/m0-photo-card`, demo root visible.
   - **Interact:** Light/Dark theme toggle + in-kit nav (prev/next or index scroll); no app chrome involved.
     Full 77-page × two-theme console-error matrix is **Manual-only** on the preview build (Done-when); CI `qa:quick` is the automated subset. No new Playwright app e2e in this prep (kit is not product UI).

## Security

- **Supply chain:** new/updated npm packages from the kit enter the root lockfile (Tailwind 4 + `@tailwindcss/vite`, `@fontsource-variable/*`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `react-aria`, kit-pinned `react`/`react-dom`/`vite`/`typescript`/`playwright-core` as workspace deps). Mitigations: `pnpm audit:ci`, GitHub dependency-review, Security Review subagent before archive.
- **Not in threat model this change:** app File System Access, workers/`postMessage`, book export, CSP policy edits. Kit is a separate static SPA under `/uikit/` on the same origin as the app preview; it does not gain FSA or privileged APIs.
- **Isolation:** app bundle must not load kit modules (CI assertion + depcruise); reduces accidental coupling of app CSP/trusted paths to kit code.

## Risks / Trade-offs

- Middleware mounting under `/uikit` can break asset URLs if `base` mismatches — keep kit `base: '/uikit/'` in both modes.
- New deps fail audit — drop/replace before archive; Security Review required.
- Large PR — accepted; size limit excludes `uikit/**`.

## Touch-set

- `uikit/**` (imported kit + README)
- `pnpm-workspace.yaml`, root `package.json`, `pnpm-lock.yaml`
- Root Vite plugin (or small `scripts/vite-uikit-middleware.mjs`) + `vite.config.ts` (plugin import only)
- `.dependency-cruiser.cjs`, `scripts/assert-no-uikit-in-app-bundle.mjs` (+ test)
- `.github/workflows/uikit.yml`; `checks.yml` only for post-build assertion step
- ESLint / Prettier ignore entries; optional `.gitignore` for `uikit/dist` if not covered by root `dist`
- OpenSpec change artifacts; `docs/roadmap/M2.5/uikit-import.md` checkbox ticks

## Open questions

None — owner decisions (one PR, size exclusion, zip path/sha) are fixed.
