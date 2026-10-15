# Design

## Context

See proposal.md. `stryker.config.json` `mutate` is an allow-list, and `scripts/stryker-diff.mjs` repeats it as `PHOTO_MUTATE`, `EDITOR_MUTATE`, and `RENDER_MUTATE`. Stryker applies patterns in order: a later `!` pattern clears a file an earlier include selected. `checks.yml` does not call `pnpm verify:fast`; it runs those steps separately. Nightly break is already 60.

## Goals / Non-Goals

**Goals:**

- One pattern list, used by the full run and by diff selection
- A guard on `pnpm verify:fast` and on the checks workflow

**Non-Goals:**

- A new dependency, a break change, issue #3, or comment-script edits. Skipped stays "success and no report". The diff script is what stops an in-scope file from taking that path.

## Decisions

1. **Patterns, includes first.** `mutate` is `src/**/*.ts` and `src/**/*.tsx`, then `!` excludes, so a later include cannot undo an exclude. JSON cannot hold comments. Each exclude has one reason line in sibling `stryker.mutate.md`. The guard fails when a `!` pattern has no reason line. Excludes: tests, benches, `*.d.ts`, `*.test-helpers.ts`, `src/core/testing/**`, `src/core/index.ts`, `src/main.tsx`, `src/photo/photo.worker.ts`.

2. **Shared classifier, no second list.** `scripts/mutation-scope.mjs` exports `loadMutatePatterns`, `classifyMutationFile`, `selectMutableChanges`, and `findUnclassifiedProductionFiles`. It reads config patterns and does not own file names. Classification follows Stryker order with a local glob (`**`, `*`, `{a,b}`, literals). `minimatch` is not a direct dependency; adding it would be a dependency bump. `stryker-diff.mjs` keeps git discovery and the Stryker spawn, drops the three sets, and filters with `selectMutableChanges`.

3. **Guard.** `scripts/check-mutation-scope.mjs` walks `src/**/*.{ts,tsx}`. Those are the production files for this gate. CSS and other assets are not mutation inputs, so they are not a reason to add excludes. Unclassified paths exit 1. Script name `pnpm mutation-scope`, called from `verify:fast` and from a new checks workflow step.

4. **Tests.** `scripts/mutation-scope.test.mjs` calls the exports with path lists. No git and no Stryker spawn. Real config: `src/photo/processPhoto.ts` in; `src/photo/processPhoto.test.ts` and `src/photo/photo.worker.ts` out; `src/perf/percentile.ts` in. A synthetic pattern set: a path that matches neither include nor exclude is unclassified. No shared fixture module.

5. **Score.** Do not edit `thresholds.break`. After apply, run full `pnpm stryker`. Below 60: an unchecked roadmap follow-up and a PR note. Do not restore an allow-list.

## Touch-set

- `stryker.config.json`, `stryker.mutate.md`
- `scripts/mutation-scope.mjs`, `scripts/mutation-scope.test.mjs`, `scripts/check-mutation-scope.mjs`, `scripts/stryker-diff.mjs`
- `package.json` (`verify:fast` and the script)
- `.github/workflows/checks.yml`
- `docs/lessons.md`, `docs/roadmap.md`
- `openspec/specs/ci-gates/spec.md` on archive

## Composition

`mutation-scope.mjs` is pure: patterns in, path classes out. The check CLI and `stryker-diff.mjs` are the process and filesystem edges. Tests call the pure exports only.

## Risks / Trade-offs

- [Local glob diverges from Stryker] → patterns stay in the supported subset; the guard run on the real `src/` tree must report zero unclassified files
- [Full score below 60] → record a follow-up; do not narrow the globs
- [Sandbox skip of `e2e` fails `budgets.mirror.test.ts` once `src/perf` is in scope] → drop `e2e` from `ignorePatterns` (the tree is small). Do not exclude `src/perf` to avoid the dry-run failure
- [Checks omits the step] → the step is in the touch-set, and the spec requires the checks workflow to fail

## Migration Plan

Replace both allow-lists in this change. Rollback is restoring the previous `mutate` array and the diff sets.
