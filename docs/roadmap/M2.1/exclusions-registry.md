# exclusions-registry

Tag: prep
Milestone: M2.1
Title: only non-production code can be excluded (issue #72 J, A)

## Scope

- [ ] `quality/exclusions.yaml` replaces `stryker.mutate.md`. Each entry has `pattern`, `gates` (coverage / mutation), `scope` (nightly / diff), `category` and `reason`. Every category is checked mechanically:
  - `test`: `*.test.*`, `*.spec.*`, `*.test-helpers.ts`, `*.bench.*`
  - `types`: `*.d.ts`
  - `barrel`: only re-exports, checked by AST
  - `entry`: `src/main.tsx` only
  - `worker-shim`: a `*.worker.ts` of 20 lines or fewer that only delegates
  - `test-fake`: no production importer, checked by dependency-cruiser
  - `separate-package`: a non-app package outside `src/` with its own `package.json` (`uikit/**` only); checked: listed in the workspace, no importer from `src/**` (dependency-cruiser), not reachable from any app Vite entry
- [ ] The currently excluded production files become `temporary` entries, each with `until: <roadmap item name>`. Those are `projectSession.ts`, `usePasteboardCamera.ts`, `EditorShell.tsx`, `previewAspect.ts`, `upgradeSessionAssets.ts`, `idb.ts`, `locks.ts`, `hash.worker.ts`, `photo.worker.ts`, plus any existing entry that fails its category check. No new `temporary` entry can be added, the set can only shrink, and CI fails if the `until` item is ticked while its entry still exists
- [ ] The registry check in `verify:fast` and the ratchet: `stryker.config.json` `mutate`, `vite.config.ts` `coverage.exclude` and `codecov.yml` `ignore` match the registry. A new entry is allowed only in a category that passes its check; the ratchet accepts a new exclude pattern only when it comes from such an entry. Production logic cannot be excluded
- [ ] `ci-gates` spec delta: "Mutation scope is the config globs" lists the registry categories and the real set. `docs/lessons.md` exclusion line points to the registry
- **Done when:** fixture PRs that exclude a production module, add a `temporary` entry, or keep a `temporary` entry after its `until` item is ticked each fail, and a new `*.test-helpers.ts` exclusion passes.
