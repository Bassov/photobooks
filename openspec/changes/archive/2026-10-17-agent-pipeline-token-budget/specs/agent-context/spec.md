# Spec Delta

## ADDED Requirements

### Requirement: Unattended flow token hygiene

`/next-roadmap-item` SHALL minimize prompt growth: no re-read of injected prompt files or of the item file after `roadmap next`; rules from `openspec instructions`; `config.yaml` operations at most once; targeted spec/item edits; quiet/trimmed verify-push-CI output; PR body once; issues as plain URLs.

#### Scenario: No re-read of injected context

- **WHEN** an agent runs `/next-roadmap-item` after receiving the command and alwaysApply rules in the prompt
- **THEN** it MUST NOT open those injected files or `AGENTS.md` again solely to rediscover mandates, and MUST NOT open the item file solely to rediscover scope already printed by `roadmap next`

#### Scenario: Rules from instructions, config once

- **WHEN** the agent needs proposal/design/tasks rules or apply/archive operations text
- **THEN** it takes rules from `openspec instructions` JSON and MAY open `openspec/config.yaml` only for `operations`, at most once in the run

#### Scenario: Quiet verify and CI output

- **WHEN** the agent runs local verify, `git push`, or waits on PR checks
- **THEN** it uses quiet verify/e2e scripts or trimmed tails, and for CI wait suppresses the watch stream then reads a compact JSON summary (failed logs tailed)

#### Scenario: PR body and issues stay compact

- **WHEN** the agent opens or updates the pull request
- **THEN** it generates the PR body once and cites related issues as plain URLs only

### Requirement: Out-of-scope failures and push budget

A gate failure outside the change's touch-set SHALL NOT be fixed inside the current PR. The agent SHALL schedule follow-up with `pnpm roadmap add … --after <current>` or open/file a bug issue for a flaky test, then continue; CI remains the gate for the PR. Local push SHALL stop after at most two failed attempts and report in the PR description instead of looping. Any code change after `openspec-implementation-reviewer` has passed SHALL re-run that reviewer on the delta before archive.

#### Scenario: Out-of-scope failure is scheduled not patched in-PR

- **WHEN** pre-push or local verify fails on a file or test outside the design touch-set
- **THEN** the agent MUST NOT enlarge the current PR to fix it; it MUST add a roadmap item or bug issue and proceed (or stop per push budget)

#### Scenario: Two push attempts then stop

- **WHEN** local `git push` fails twice under pre-push
- **THEN** the agent MUST stop further push loops and record the failure in the PR description (or stop and ask if no PR exists yet)

#### Scenario: Post-review code needs re-review

- **WHEN** the working tree changes after an implementation-reviewer `pass`
- **THEN** archive MUST NOT proceed until implementation review passes again on that delta

### Requirement: Narrow reviewer briefs

Parent agents SHALL brief `openspec-proposal-reviewer`, `openspec-design-reviewer`, and `openspec-implementation-reviewer` with the change slug, change path, the relevant `rules` array for that stage, `git diff --stat`, and the touch-set working-tree diff. Reviewers SHALL prefer that brief over opening `openspec/config.yaml` or the full roadmap item. Reviewers MUST NOT read other sessions' agent transcripts and MUST NOT run unrelated tool-discovery loops.

#### Scenario: Reviewer uses parent brief

- **WHEN** a listed OpenSpec reviewer subagent starts
- **THEN** its inputs are the parent brief (slug, path, rules, stat, touch-set diff) and it does not open full `openspec/config.yaml` solely to rediscover those rules

#### Scenario: No other-session transcripts

- **WHEN** a reviewer needs evidence
- **THEN** it MUST NOT read transcripts under other sessions' agent-transcript directories and MUST NOT run tool discovery unrelated to the change

### Requirement: Pre-push verify:fast; e2e in CI

Lefthook pre-push SHALL run `pnpm verify:fast` only. Full Playwright e2e SHALL remain a required CI check on every PR. This split MUST NOT exclude production files from coverage or mutation or otherwise weaken quality gates.

#### Scenario: Pre-push is verify:fast

- **WHEN** an agent pushes a branch with Lefthook installed
- **THEN** the pre-push hook runs `pnpm verify:fast` and does not require local Playwright as part of that hook

#### Scenario: CI still gates e2e

- **WHEN** a pull request is opened or updated
- **THEN** CI still runs Playwright e2e as a required gate for the PR

### Requirement: Agent environment bootstrap

The repository SHALL provide a sourced bootstrap script that makes Node 22 and pnpm available to non-interactive agent shells without writing a `.tool-versions` (or equivalent pin file) into the repository tree. `AGENTS.md` SHALL document that bootstrap in navigation form (≤150 lines, no checklist).

#### Scenario: Bootstrap without repo tool-versions

- **WHEN** an agent sources the bootstrap script in a clean non-interactive shell
- **THEN** `pnpm` and Node 22 are on PATH and no `.tool-versions` file is created under the repository root
