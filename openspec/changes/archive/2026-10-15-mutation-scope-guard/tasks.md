# Tasks

## 1. Shared mutate scope

- [x] 1.1 Add `scripts/mutation-scope.mjs` with `loadMutatePatterns`, `classifyMutationFile`, `selectMutableChanges`, and `findUnclassifiedProductionFiles`, plus `scripts/mutation-scope.test.mjs`. Verify a changed `processPhoto.ts` and `src/perf/percentile.ts` are selected, and a changed test and `photo.worker.ts` are not.
- [x] 1.2 Replace `stryker.config.json` `mutate` with `src/**/*.ts` and `src/**/*.tsx` plus the locked `!` excludes, document each exclude in `stryker.mutate.md`, and make `scripts/stryker-diff.mjs` filter with `selectMutableChanges` only. Verify the diff script has no `PHOTO_MUTATE` / `EDITOR_MUTATE` / `RENDER_MUTATE` lists and the unit test passes against the shipped config.

## 2. Check and docs

- [x] 2.1 Add `scripts/check-mutation-scope.mjs`, `pnpm mutation-scope`, a `verify:fast` step, and a checks workflow step. Update the `pnpm verify:fast` row in `AGENTS.md`. Verify `pnpm mutation-scope` exits 0 and names any unclassified file or exclude that lacks a reason.
- [x] 2.2 Replace the `docs/lessons.md` bullet that says both lists must be extended by hand. After `drag-swap-unplace` and before M2, add the five unchecked roadmap items. Verify those items are unchecked and the old lesson sentence is gone.

## 3. Nightly score

- [x] 3.1 Run full `pnpm stryker` with break left at 60. If the score is below 60, add an unchecked roadmap follow-up and do not narrow the globs. Verify the break value is still 60 and the score is recorded.

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected — N/A, no UI or bundle change
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A, no UI
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A, script-only package.json edit
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive — N/A, CI tooling, reviewer confirmed security surface is out of scope

## Workflow follow-up

- Archive after implementation review passes, syncing the `ci-gates` delta.
- Tick only `mutation-scope-guard` in `docs/roadmap.md` as part of the archive.
- Open the PR and close issue #46.
