# Spec Delta

## ADDED Requirements

### Requirement: Composite agent stage commands

The repository SHALL provide a zero-dependency Node CLI (`pnpm agent`, `scripts/agent.mjs`) that collapses `/next-roadmap-item` shell stages into `preflight`, `finish`, and `review-brief`. The CLI SHALL support `--json` and short success output, and SHALL suppress ANSI/spinners when `CI` is set or `--quiet` is passed. `/next-roadmap-item` SHALL invoke these commands for steps that previously required multi-call shell sequences.

#### Scenario: Preflight one report

- **WHEN** an agent runs `pnpm agent preflight` on a clean tree with agent-env available
- **THEN** the command checks env (node/pnpm), syncs `main`, builds a skip-list from open PRs and remote `feat|fix/*` branches, runs `roadmap next --skip`, creates `feat/<slug>` (or `fix/` for bug tags), and prints one compact report including the item, openspec `{template,rules}` for the next artifact stage when available, and the touch-set path or placeholder

#### Scenario: Finish push PR CI

- **WHEN** an agent runs `pnpm agent finish` after commits exist on the feature branch
- **THEN** the command runs `verify:fast:quiet`, verifies the tree is ready to push (no uncommitted work that would block push), pushes with at most two failed attempts, creates or updates the PR, waits for CI with a silent watch then a compact JSON summary, and on failure prints a one-screen report including a tailed `--log-failed` log

#### Scenario: Finish does not invent commits

- **WHEN** `pnpm agent finish` runs and the working tree is dirty
- **THEN** it exits non-zero with a short error and MUST NOT create a commit message or commit on behalf of the agent

#### Scenario: Finish never commits

- **WHEN** `pnpm agent finish` runs on a clean tree
- **THEN** it MUST NOT run `git commit` (push/PR/CI only)

#### Scenario: Review brief one call

- **WHEN** an agent runs `pnpm agent review-brief` for the current change
- **THEN** the output includes slug, change path, the relevant rules array (or path to obtain them), `git diff --stat`, and the touch-set working-tree diff suitable to paste into a reviewer subagent

#### Scenario: JSON and quiet modes

- **WHEN** the agent passes `--json` or `--quiet` (or `CI` is set)
- **THEN** success output is machine-readable JSON or short non-ANSI text respectively

### Requirement: Unattended flow call batching

`/next-roadmap-item` SHALL batch independent tool work: parallel reads/greps in one step; dependent shell steps chained with `&&` in one call; no check-then-recheck loops. OpenSpec artifact stages SHALL write each artifact in one Write and validate once at the end of the stage, not after every edit.

#### Scenario: Parallel independent reads

- **WHEN** the agent needs several independent file reads or greps
- **THEN** it issues them in one parallel tool step

#### Scenario: One validate per artifact stage

- **WHEN** the agent finishes writing an OpenSpec planning artifact for a stage
- **THEN** it validates once at stage end rather than after each incremental edit

### Requirement: Pipeline MCP surface

`AGENTS.md` SHALL document which MCP servers the unattended pipeline needs (minimal set) and that other project-enabled MCP servers SHOULD be disabled for this repo so their tool schemas are not re-sent on every model call. This requirement does not add MCP dependencies to the repository.

#### Scenario: Minimal MCP documented

- **WHEN** an agent opens `AGENTS.md` Commands / Toolchain sections
- **THEN** it can see which MCP servers the pipeline needs and that unused servers should be disabled for this project

## MODIFIED Requirements

### Requirement: Unattended roadmap item flow

The project SHALL provide `/next-roadmap-item` to run one open roadmap item (`pnpm roadmap next`) end to end without editing CLI-generated `opsx-*` or `openspec-*` files. Mandates stay in `openspec/config.yaml` and `.cursor/rules/git-finish.mdc`. Security-tagged or security-surface items continue and MUST pass Security Review before archive. Until ratchet or dependency-policy items merge, gate-config and dependency rules in the command scenarios apply. Preflight, finish, and reviewer briefing SHALL use `pnpm agent` composite commands instead of multi-call shell recipes for the same work.

#### Scenario: Command exists and points at SoT

- **WHEN** an agent opens `.cursor/commands/next-roadmap-item.md`
- **THEN** the command describes the end-to-end stages and references `openspec/config.yaml`, `git-finish.mdc` and skill `roadmap` as mandate sources without restating their full checklists

#### Scenario: Command uses composite agent CLI

- **WHEN** an agent follows `.cursor/commands/next-roadmap-item.md`
- **THEN** preflight and finish (and reviewer briefing) are expressed as `pnpm agent` invocations rather than expanded multi-call shell recipes for the same work

#### Scenario: Security-tagged item continues to Security Review

- **WHEN** the selected roadmap item is tagged `(Security Review: …)` or touches the security surface
- **THEN** the unattended flow MUST continue (it MUST NOT stop solely for that reason) and MUST complete Security Review before archive

#### Scenario: Gate-config edit before ratchet lands

- **WHEN** the selected item edits a quality-gate config and `gate-ratchet`/`gate-ratchet-ci` are not yet merged
- **THEN** the edit MUST be strictly stricter and listed in the touch-set with a reason, or the run MUST stop

#### Scenario: New dependency before dependency-policy lands

- **WHEN** the change adds or changes a dependency and `dependency-policy` is not yet merged
- **THEN** apply MUST include `pnpm audit:ci` evidence and a Security Review pass before archive

#### Scenario: Item selection skips blocked work

- **WHEN** the command picks the next roadmap item
- **THEN** it runs `pnpm roadmap next --skip <slugs with an open PR or remote branch>`, which skips those slugs and `[contingency]` items, and the run stops at a milestone review cut reported by `done`

#### Scenario: Defined stop conditions only

- **WHEN** the unattended run encounters a dirty working tree, a milestone review cut, intent that conflicts with a spec or open issue, three red CI fix rounds, or a PR that conflicts with `main`
- **THEN** the run MUST stop and ask; otherwise it MUST continue through archive, PR, and green CI
