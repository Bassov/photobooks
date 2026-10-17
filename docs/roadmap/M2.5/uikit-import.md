# uikit-import

Tag: prep
Milestone: M2.5
Title: UI kit in the repo as the UI/UX reference (~950 lines + lockfile; step 1 of 10, rest via the growth rule below)

## Scope

- [ ] `uikit/` as a separate workspace package with its own `package.json`, Vite config, `tsconfig`, `.gitignore`, `scripts/file-protocol.ts`; kit shell (index with search / filter / restore, feature page, prev/next, router, theme), full `src/kit/pages.json` manifest (77 pages) with an empty `FEATURES` registry (pages show the placeholder until their step lands), tokens CSS, fonts + licences; nothing under `src/` imports it and it is not production logic
- [ ] Kept out of the app build, coverage and mutation only through the `separate-package` category of `quality/exclusions.yaml` (from `exclusions-registry`), never as a `temporary` or production entry; kit dependencies go into the root `pnpm-lock.yaml` (no `package-lock.json`) and pass `dependency-policy`
- [ ] CI job `uikit` that installs and builds the kit (`typecheck` + `build`); `uikit/README.md`: what the kit is, how to run it, how roadmap items point to it (`UI ref: uikit#/feature/<slug>`), `docs/roadmap.md` is the source of truth
- [ ] At most ~1000 changed lines; `diff-size-check` already excludes `pnpm-lock.yaml`, binary files (fonts) and image / SVG / photo assets (`uikit/public/**`); the remaining kit lands as the next checkboxes
- **Done when:** `uikit/` builds in its own CI job, `uikit/dist/index.html#/` opens over file:// and lists all 77 pages, the app build, coverage and mutation sets are unchanged, and `pnpm deps` fails when `src/**` imports from `uikit/`.
