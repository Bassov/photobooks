# exclusions-registry

Tag: prep
Milestone: M2.1
Title: only non-production code can be excluded (issue #72 J, A)

## Scope

- [ ] `quality/exclusions.yaml` replaces `stryker.mutate.md` and `mutation.temporaryExcludes`. Each entry has `pattern`, `gates` (coverage / mutation), `scope` (nightly / diff), `category` and `reason`. Categories checked mechanically: `test`, `types`, `barrel` (AST: re-exports only), `entry` (`src/main.tsx` only), `worker-shim` (≤ 20 lines, delegates only), `cli-entry` (`scripts/*-cli.mjs` ≤ 10 lines, delegates only), `test-fake` (no production importer, dependency-cruiser), `separate-package` (`uikit/**` only)
- [ ] The current product excludes become `temporary` entries, each with `until: <item>`: `previewAspect.ts`, `upgradeSessionAssets.ts`, `photo.worker.ts`, `hash.worker.ts` → `mutation-reinclude-small`; `usePasteboardCamera.ts` → `mutation-reinclude-camera`; `idb.ts`, `locks.ts` → `session-idb-locks-mutation`; `EditorShell.tsx` → `editor-shell-mutation`; `HomeScreen.tsx`, `App.tsx` → `home-app-mutation`; `projectSession.ts` → `project-session-mutation`. No new `temporary` entry, the set only shrinks. `until` names a roadmap slug, or `backlog/<slug>` when the clearing item left the roadmap (entries stay temporary either way). CI fails if a roadmap `until` item is ticked while its entry remains; that tick-check does not apply to `backlog/<slug>` targets
- [ ] The registry check runs in `verify:fast` and the ratchet: `stryker.config.mjs` `mutate`, `vite.config.ts` `coverage.exclude` and `codecov.yml` `ignore` match it. `test-fake` modules stop counting toward coverage (moved here from `codecov-patch-gate`)
- [ ] `ci-gates` spec delta lists the categories and the real set
- [ ] Register `uikit/**` under the `separate-package` category (UI kit, owner decision 2026-10-19).
- **Done when:** fixture PRs that exclude a production module, add a `temporary` entry, or keep one after its `until` item is ticked each fail, and a new `*.test-helpers.ts` exclusion passes.
- **Size:** ~900 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 J, A
