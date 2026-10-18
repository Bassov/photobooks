## ADDED Requirements

### Requirement: Unified deterministic check entry

The repository SHALL provide `pnpm check` as the single entry for deterministic local gates. Independent checks SHALL all run in one invocation and MUST NOT stop at the first failure. Exit code SHALL be non-zero when any check failed. Local Playwright e2e SHALL stay separate. Compaction SHALL live in project scripts (no rtk).

#### Scenario: Multiple failures reported together

- **WHEN** a working tree has distinct lint, unit, and roadmap failures and an agent runs `pnpm check`
- **THEN** the command exits non-zero and reports all three failure classes in that one run

#### Scenario: E2e stays separate

- **WHEN** an agent runs `pnpm check`
- **THEN** the command does not run Playwright e2e as part of that entry

#### Scenario: Optional policy scripts when present

- **WHEN** local pr-policy / diff-size / pr-body scripts exist on disk
- **THEN** `pnpm check` includes them in the same fail-all pass

### Requirement: Compact check command output

`pnpm check` and each sub-check it runs SHALL default to minimal stdout: one `OK <check> (<time>)` line on success, or capped problem lines plus a `.cache/checks/` log pointer on failure. `--verbose` SHALL restore full tool output. Agent finish MUST surface pre-push/`pnpm check` failures in that compact shape.

#### Scenario: No noisy success chrome

- **WHEN** checks pass in default mode
- **THEN** stdout has no banners, progress bars, or passing-test lists

#### Scenario: Green check is one line per check

- **WHEN** all checks pass under default (non-verbose) mode
- **THEN** stdout has at most one `OK` line per check and no passing-test enumeration

#### Scenario: Failures are capped with log path

- **WHEN** a check fails with more problems than the cap
- **THEN** stdout shows at most the capped problem lines plus a `… +N more, full log: <path>` style trailer pointing under `.cache/checks/`

### Requirement: Agent docs name one check command

`openspec/config.yaml` quality-bar / apply guidance / tasks verification template, `AGENTS.md`, and `.cursor/commands/next-roadmap-item.md` SHALL direct agents to run `pnpm check` until only OK lines appear, instead of listing each sub-check as the primary verification recipe. Individual scripts MAY remain available without being listed as the agent default.

#### Scenario: Navigation points at pnpm check

- **WHEN** an agent opens `AGENTS.md` Commands or the next-roadmap-item command guidance
- **THEN** the primary verify instruction names `pnpm check` rather than enumerating typecheck/lint/test as separate required steps

### Requirement: Preflight stale branch and checklist ids

When `pnpm agent preflight` reuses a local feature branch that is behind `origin/main`, it SHALL warn and take the merge-or-recreate path (never rebase or force-update): recreate from `origin/main` when the branch has no unique commits to preserve, otherwise merge `origin/main`. Preflight output SHALL include ids from `quality/review-checklist.md` when that file exists, and MUST NOT embed the full checklist text.

#### Scenario: Behind origin/main is flagged

- **WHEN** preflight reuses `feat/<slug>` whose tip is behind `origin/main`
- **THEN** the command warns that the branch is stale and completes merge-or-recreate (no rebase/force) before treating preflight as successful

#### Scenario: Checklist ids only

- **WHEN** `quality/review-checklist.md` exists with row ids
- **THEN** preflight includes those ids in its compact report and does not include the full checklist prose

## MODIFIED Requirements

### Requirement: Pre-push verify:fast; e2e in CI

Lefthook pre-push SHALL run `pnpm check` (the unified deterministic entry) only. Full Playwright e2e SHALL remain a required CI check on every PR. This split MUST NOT exclude production files from coverage or mutation or otherwise weaken quality gates.

#### Scenario: Pre-push is verify:fast

- **WHEN** an agent pushes a branch with Lefthook installed
- **THEN** the pre-push hook runs `pnpm check` and does not require local Playwright as part of that hook

#### Scenario: CI still gates e2e

- **WHEN** a pull request is opened or updated
- **THEN** CI still runs Playwright e2e as a required gate for the PR

### Requirement: Composite agent stage commands

The repository SHALL provide a zero-dependency Node CLI (`pnpm agent`, `scripts/agent.mjs`) that collapses `/next-roadmap-item` shell stages into `preflight`, `finish`, and `review-brief`. The CLI SHALL support `--json` and short success output, and SHALL suppress ANSI/spinners when `CI` is set or `--quiet` is passed. `/next-roadmap-item` SHALL invoke these commands for steps that previously required multi-call shell sequences.

#### Scenario: Preflight one report

- **WHEN** an agent runs `pnpm agent preflight` on a clean tree with agent-env available
- **THEN** the command checks env (node/pnpm), syncs `main`, builds a skip-list from open PRs and remote `feat|fix/*` branches, runs `roadmap next --skip`, creates `feat/<slug>` (or `fix/` for bug tags), and prints one compact report including the item, openspec `{template,rules}` for the next artifact stage when available, and the touch-set path or placeholder

#### Scenario: Finish push PR CI

- **WHEN** an agent runs `pnpm agent finish` after commits exist on the feature branch
- **THEN** the command verifies the tree is ready to push (no uncommitted work that would block push), pushes with hooks enabled so `pnpm check` runs exactly once via pre-push (no separate full verify before that push; never `--no-verify`), creates or updates the PR, prints the PR URL, and exits without watching or polling CI (`gh pr checks --watch` MUST NOT run)

#### Scenario: Finish does not invent commits

- **WHEN** `pnpm agent finish` runs and the working tree is dirty
- **THEN** it exits non-zero with a short error and MUST NOT create a commit message or commit on behalf of the agent

#### Scenario: Finish never commits

- **WHEN** `pnpm agent finish` runs on a clean tree
- **THEN** it MUST NOT run `git commit` (push/PR only)

#### Scenario: Review brief one call

- **WHEN** an agent runs `pnpm agent review-brief` for the current change
- **THEN** the output includes slug, change path, the relevant rules array (or path to obtain them), `git diff --stat`, and the touch-set working-tree diff suitable to paste into a reviewer subagent

#### Scenario: JSON and quiet modes

- **WHEN** the agent passes `--json` or `--quiet` (or `CI` is set)
- **THEN** success output is machine-readable JSON or short non-ANSI text respectively

### Requirement: Auto-merge trivial main conflicts on finish

When a feature PR conflicts with `main`, git-finish / `pnpm agent finish` SHALL fetch and merge `origin/main`. It MAY auto-resolve only (1) `docs/roadmap.md` hunks where both sides purely ADD distinct whole lines relative to the merge base (parallel `roadmap add`), keeping both added lines, and (2) `pnpm-lock.yaml` via `pnpm install` when `package.json` itself has no conflict. After an auto-resolution it MUST run `pnpm -s roadmap check` before committing the merge; a failed check is treated as a semantic conflict. Any other conflict (item files, lessons, RULES/INTRO, modified or deleted base lines, `package.json`) MUST leave the merge in progress (or abort it), MUST NOT commit, and MUST fail with a message listing the files and instructing to resolve per `git-finish.mdc` then run finish again. Deterministic verify after the merge SHALL run exactly once via pre-push `pnpm check` on the subsequent push (finish MUST NOT run a separate full verify before that push), and MUST NOT rebase or force-push.

#### Scenario: Pure-add index conflict merges

- **WHEN** finish detects a conflict with `main` that is only pure-add lines in `docs/roadmap.md` (and/or a lockfile clash without `package.json` conflict)
- **THEN** it merges, auto-resolves, runs `roadmap check`, commits the merge, and relies on pre-push `pnpm check` for the deterministic suite on push without stopping for a human

#### Scenario: Modified-line or item-file conflict stops

- **WHEN** finish encounters a modified-line conflict in `docs/roadmap.md`, any conflict under an item file, or other non-allowlisted paths
- **THEN** it leaves the merge unresolved, does not commit, and reports with guidance to resolve per `git-finish.mdc` then run finish again

#### Scenario: Semantic conflict stops

- **WHEN** finish encounters overlapping semantic code conflicts
- **THEN** it stops and reports without force-push or rebase
