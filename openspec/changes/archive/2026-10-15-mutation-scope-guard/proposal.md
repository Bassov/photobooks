# Proposal

## Problem

Mutation scope is two allow-lists (`stryker.config.json` `mutate` and the sets in `scripts/stryker-diff.mjs`). A new `src/` file is skipped until both are edited by hand. An empty mutate set shows Skipped, so that omission looks intentional. Closes #46.

## Why now

Production modules already missing from both lists never get a diff mutation score.

## Scope in

- One source of truth: `src/**/*.ts` and `src/**/*.tsx` in `stryker.config.json`. Diff keeps changed files matched by those globs and not negated by `!` excludes. The diff script drops its own file lists.
- Exclude only pointless-to-mutate files, each with a one-line reason beside the config: tests, benches, `*.d.ts`, `*.test-helpers.ts`; fixtures `src/core/testing/**`; barrel `src/core/index.ts`; `src/main.tsx`; `src/photo/photo.worker.ts` (onmessage wrapper; logic is in `processPhoto.ts`).
- Everything else stays in scope, including `*.tsx`, `src/perf/**`, and modules missing today. Thin UI is not an exclude reason.
- The guard fails both `pnpm verify:fast` and the checks workflow when a production file under `src/` is neither covered nor excluded.
- Unit test: changed `processPhoto.ts` is mutated; a changed test and `photo.worker.ts` are not; a file on neither allow-list today (`src/perf/percentile.ts`) is mutated.
- Nightly break stays 60. A full-run miss is recorded in the PR and `docs/roadmap.md`, not fixed by an allow-list.
- `docs/lessons.md` no longer says both lists must be extended by hand.
- Delta to `ci-gates` so Skipped cannot hide an unclassified or in-scope production change.
- After `drag-swap-unplace`, before M2, add five unchecked roadmap items. Tick only this change after archive.

## Scope out

- Restoring an allow-list or lowering the break to protect the score
- Issue #3 (Stryker vitest-runner patch)
- UI, e2e, and app behavior

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `ci-gates`: mutate scope is the config globs; checks fail on an unclassified production file; Skipped does not cover a silent omit

## Success criteria

- A new production file under `src/` with no include or exclude decision fails `pnpm verify:fast` and the checks workflow.
- Nightly break stays 60. A miss is a recorded follow-up, not a narrower list.

## Risks

- The wider nightly set may score below 60. The follow-up is a note, not a restored allow-list.
- Checks run verify steps apart from the `verify:fast` script, so the guard must be on that workflow too.
