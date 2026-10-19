# Design

## Context

Hand-lists in `vite.config.ts` coverage `include`, `stryker.config.mjs` `mutate`, and `codecov.yml` `flags.unit.paths` already cover a subset of gate scripts. `check-mutation-scope` only walks `src/`. `pr-policy` compares include/exclude/bang sets by exact string equality, so a naive hand-list→glob swap would look like weakening on base until subsumption lands. `pull_request_target` runs base scripts; local/`pnpm check` pr-policy uses HEAD.

## Goals / Non-Goals

**Goals:**

- Default script scope: `scripts/**/*.mjs` minus tests and ≤10-line delegating CLIs
- Unclassified production scripts fail `verify:fast`
- Named gate scripts enter nightly mutate; diff applies on change
- Done-when proofs on real helpers/config (foo.mjs, unclassified, remove scripts/**)
- pr-policy: glob subsumption; paired script test/CLI excludes allowed; removing script glob include fails

**Non-Goals:**

- Editing `scripts/agent.mjs` (other session); new tests for it go in a new file only if required
- Package.json dependency changes
- Reaching mutation ≥85 on every untouched script in this PR (diff gate on touch; growth for bar failures)
- Making `pull_request_target` execute head code

## Decisions

1. **Shared globs** — Vitest `coverage.include`: `scripts/**/*.mjs`; excludes: `scripts/**/*.test.mjs` + thin CLIs. Stryker: same include/bangs (`stryker.mutate.md`). Codecov `flags.unit.paths`: `scripts/` (drop hand-list). Remove hand-listed script entries after subsumption lands in the ratchet.

2. **Thin CLI** — Bang-exclude only files that are ≤10 lines, sole sibling `.mjs` import, and invoke that import (e.g. `agent-cli.mjs`). `stryker-pr-summary-cli.mjs` (11 lines) stays in mutate/coverage scope. No name-based shortcuts.

3. **Mutation-scope** — Also walk `scripts/**/*.mjs` (skip `*.test.mjs`); reuse classify helpers; error text mentions scripts.

4. **Ratchet (HEAD)** — Include removal fails unless a remaining head glob subsumes the path (`matchGlob`); always fail if `scripts/**` / `scripts/**/*.mjs` drops. Paired new excludes/bangs allowed only for `scripts/**/*.test.mjs` and ≤10-line sole-import CLIs when head has the scripts include glob. Codecov: `scripts/` covers former per-file paths; removing `scripts/` fails.

5. **`scripts/foo.mjs`** — Literal Done-when probe: tiny pure helper imported by script listing/tests so coverage + `stryker:diff` pick it up with no config edit.

6. **Untouched hard scripts** — Enter via glob without edits. If this PR first-touches one and it misses ≥85 / 0 NoCoverage, `pnpm roadmap add … --after scripts-in-scope` for tests — never bang-exclude product logic.

7. **Touch-set** — `vite.config.ts`, `stryker.config.mjs`, `stryker.mutate.md`, `codecov.yml`, `check-mutation-scope.mjs` (+test), `foo.mjs` (+test), `script-include-ratchet.mjs` (+test), `check-gate-ratchet.mjs` (+test), `mutation-scope.test.mjs`, OpenSpec/roadmap/`ci-gates` delta. No `agent.mjs`, no other-session paths, no package.json/lockfile deps.

## Risks / Trade-offs

- Coverage dilution from newly included untested scripts — monitor vs 80% floors; add minimal tests only if thresholds fail.
- Base `pull_request_target` pr-policy may still flag hand-list→glob until merge; HEAD `pnpm check` is the merge gate for the new rules (`pr-policy` not in `requiredCheckJobs` today).
- Nightly full mutation grows with every script — acceptable; break stays 60.
