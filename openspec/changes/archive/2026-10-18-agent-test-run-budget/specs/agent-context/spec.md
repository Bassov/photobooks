## MODIFIED Requirements

### Requirement: Composite agent stage commands

The repository SHALL provide a zero-dependency Node CLI (`pnpm agent`, `scripts/agent.mjs`) that collapses `/next-roadmap-item` shell stages into `preflight`, `finish`, and `review-brief`. The CLI SHALL support `--json` and short success output, and SHALL suppress ANSI/spinners when `CI` is set or `--quiet` is passed. `/next-roadmap-item` SHALL invoke these commands for steps that previously required multi-call shell sequences.

#### Scenario: Preflight one report

- **WHEN** an agent runs `pnpm agent preflight` on a clean tree with agent-env available
- **THEN** the command checks env (node/pnpm), syncs `main`, builds a skip-list from open PRs and remote `feat|fix/*` branches, runs `roadmap next --skip`, creates `feat/<slug>` (or `fix/` for bug tags), and prints one compact report including the item, openspec `{template,rules}` for the next artifact stage when available, and the touch-set path or placeholder

#### Scenario: Finish push PR CI

- **WHEN** an agent runs `pnpm agent finish` after commits exist on the feature branch
- **THEN** the command runs `verify:fast:quiet`, verifies the tree is ready to push (no uncommitted work that would block push), pushes with at most two failed attempts, creates or updates the PR, prints the PR URL, and exits without watching or polling CI (`gh pr checks --watch` MUST NOT run)

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

## ADDED Requirements

### Requirement: Local agent test-run budget

Agent navigation docs and `/next-roadmap-item` SHALL state that local verification uses targeted quiet unit tests and quiet e2e only for specs in the burn-in target set, each once when green. CI burn-in is the flake authority. Local repeat of a specific e2e spec is allowed only after that spec failed locally and then passed on a rerun, and MUST NOT exceed three repeats.

#### Scenario: Docs state once-green local policy

- **WHEN** an agent reads `AGENTS.md` or `/next-roadmap-item`
- **THEN** it can find the once-green targeted quiet policy and the local max-three repeat exception for a flake that already surfaced locally

#### Scenario: Quiet changed e2e reuses burn-in targets

- **WHEN** an agent runs the quiet changed-e2e command with a diff that changes e2e specs or e2e support files
- **THEN** the run exercises the same target set the burn-in resolver would select, uses a quiet reporter, and prints failures plus a one-line summary

#### Scenario: No local targets exits without Playwright suite

- **WHEN** the quiet changed-e2e command finds no burn-in targets
- **THEN** it exits successfully without running the full Playwright suite and prints a short no-targets summary

### Requirement: Agent finish does not watch CI

Git-finish and `/next-roadmap-item` SHALL instruct agents not to wait on or poll CI after push. Opening or updating the PR ends the unattended finish stage; humans or later review read CI.

#### Scenario: Command forbids CI watch after push

- **WHEN** an agent follows `/next-roadmap-item` finish guidance or `.cursor/rules/git-finish.mdc`
- **THEN** those texts MUST NOT require `gh pr checks --watch` or equivalent polling loops after push

#### Scenario: Finish success is PR URL

- **WHEN** `pnpm agent finish` successfully pushes and creates or updates a PR
- **THEN** its success report includes the PR URL and does not include a CI watch summary as a required stage

### Requirement: PR body agent-run metrics

When `pnpm agent finish` creates a pull request, the PR body SHALL include an auto-filled metrics section with the agent-run wall time for that session. When the environment or CLI reports token usage, that value SHALL appear in the same section; when unavailable, wall time alone is sufficient and the token field MAY be omitted.

#### Scenario: Wall time recorded on create

- **WHEN** `pnpm agent finish` creates a PR after a preflight that started the run clock
- **THEN** the PR body metrics section includes a wall-time value derived automatically (not typed by the agent)

#### Scenario: Token usage when reported

- **WHEN** the finish environment exposes a token-usage value from the agent CLI
- **THEN** the PR body metrics section includes that token usage

#### Scenario: Missing tokens still succeeds

- **WHEN** token usage is not available
- **THEN** finish still creates the PR with wall-time metrics and does not fail for missing tokens
