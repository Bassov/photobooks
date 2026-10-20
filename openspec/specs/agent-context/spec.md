# agent-context Specification

## Purpose

Keeps agent navigation, OpenSpec per-change mandates, distilled skills, and CI security gates coherent so agents do not rediscover the project on every change.

## Requirements

### Requirement: Mandate ownership and navigation

Per-change mandates SHALL live only in `openspec/config.yaml`. Root `AGENTS.md` SHALL map `src/` capabilities to `openspec/specs/` and list verify/security commands as reference only (no duplicate verification checklist or OpenSpec pipeline). Each agent-facing mandate SHALL have one owner: OpenSpec/`config.yaml` quality bar; finish/PR → `git-finish.mdc`; verify/flake → `testing.mdc`; overview → `overview.mdc`; architecture → `architecture.mdc`; unattended pipeline → `next-roadmap-item.md`; navigation → `AGENTS.md`. Rule-file sizes SHALL stay within `quality/gates.json` `agentRules.budgets`. Agents MUST NOT add an alwaysApply rule without merging or removing another. Skills `react-composition`, `react-perf-spa`, `ui-review`, and `write-tests` SHALL be available under `.cursor/skills/` (write-tests MUST require concrete per-frame e2e outcomes for place/swap/move, not counts alone).

#### Scenario: Mandates and map load correctly

- **WHEN** an agent loads OpenSpec instructions or opens `AGENTS.md`
- **THEN** mandates come from `config.yaml`, the module map resolves capabilities to specs, AGENTS does not restate verify/finish pipelines or a findings journal, and rule budgets are enforced by `pr-policy`

### Requirement: Archive syncs deltas and closes roadmap

When a change has delta specs, archive SHALL sync them into `openspec/specs/`, verify the merge, then move the change. After the move, archive SHALL close the matching roadmap item with `pnpm roadmap done <slug>` and MAY close a related unused `[contingency]` with `--note`. Before the move, the agent SHALL grep README, AGENTS, `.cursor/rules`, and `docs/` for drift (or note "No doc changes").

| Condition                | Required outcome                                                         |
| ------------------------ | ------------------------------------------------------------------------ |
| Delta sync blocked       | MUST NOT move the change                                                 |
| No delta specs           | Archive MAY proceed; record that none were synced                        |
| Last milestone item done | Milestone folder moves to `docs/roadmap/archive/<M>/` in the same commit |

#### Scenario: Sync-then-archive

- **WHEN** archive is requested for a completed change with delta specs
- **THEN** sync and verify succeed before the move, roadmap done runs after, and drift grep ran

### Requirement: Planning and implementation review

After proposal, design, tasks, and specs (when not skipped) are written, the parent SHALL obtain one `openspec-planning-reviewer` pass before apply (docs-only without `design.md` skips design-checklist items). At most one planning delta re-review. Implementation review stays mandatory. Parents SHALL brief reviewers via `pnpm agent review-brief --out <file>` (slug, path, rules, `git diff --stat`, touch-set diff); reviewers MUST NOT read other sessions' transcripts or rediscover rules from full `config.yaml`. Any code change after an implementation-reviewer pass SHALL re-run that reviewer before archive.

#### Scenario: One planning pass then apply

- **WHEN** planning artifacts are ready
- **THEN** one planning reviewer pass is required before apply, briefed via a brief file path

### Requirement: Design touch-set and reviewer severities

Quality-gate / CI config edits (`quality/gates.json`, `codecov.yml`, `stryker.config.mjs`, `vite.config.ts`, `.github/workflows/*`, coverage/mutation/ESLint/tsconfig strictness, or equivalent) SHALL appear in the design touch-set with a stated reason. `openspec-implementation-reviewer` severities:

| Touch                                                                            | Severity / outcome                                             |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Gate/CI config missing from touch-set, no reason, or less strict                 | **high**                                                       |
| Listed gate edit that is strictly stricter                                       | not blocking                                                   |
| Unrelated subsystem outside proposal scope                                       | **high**                                                       |
| Intra-subsystem helper/test extract under same `src/<capability>/` or `scripts/` | MUST NOT fail review or require retrospective `design.md` edit |
| Same-diff exclusion of a modified production file from coverage/mutation         | **critical**                                                   |

Mechanical `tasks.md` checkbox completion (`- [x]` evidence) SHALL be enforced by deterministic pre-review / pre-push self-check (`pnpm quality:self-check`; owned by agent-self-check / agent G), not by re-invoking the LLM reviewer solely to verify boxes.

#### Scenario: Gate edit outside touch-set is high

- **WHEN** review finds a gate/CI config edit not listed in the touch-set with a reason
- **THEN** severity is at least high

#### Scenario: Intra-subsystem extract is not a touch-set failure

- **WHEN** implementation extracts a helper or test file under the same capability directory already in scope
- **THEN** review MUST NOT fail solely for that path missing from `design.md`

### Requirement: Compact agent CLI and run card

`pnpm agent` (`scripts/agent.mjs`) SHALL provide `preflight`, `finish`, `review-brief`, `instructions`, and `stats` with `--json` / `--quiet` (ANSI off when `CI` or `--quiet`). Preflight SHALL print a compact run card (per ready artifact: template, rules, ≤10-line apply/archive procedure). `pnpm agent instructions <artifact>` SHALL return that artifact's template and rules without raw OpenSpec shell reads. `.cursor/cli.json` SHALL deny raw reads of `openspec instructions`, `openspec/config.yaml`, `.cursor/skills/openspec-*`, and `.cursor/agents/*` without loosening existing denies. Exploration defaults (scoped grep ≤30, offset/limit over 400 lines, no unchanged re-read, no TodoWrite in unattended `-p`, Task = skill set + brief path) SHALL appear in AGENTS or the run card.

#### Scenario: Preflight and instructions

- **WHEN** an agent runs `pnpm agent preflight` or `instructions <artifact>`
- **THEN** the run card / artifact rules are printed without rediscovering mandates from injected prompt files

### Requirement: Agent stats thresholds

`pnpm agent stats <path>` SHALL accept JSON/JSONL rounds or SQLite `store.db`, print per-round metrics and peak context, and exit 1 when peak context >300000 or first-round input >400000 (invalid rounds → non-zero).

#### Scenario: Over threshold fails

- **WHEN** peak context >300000 or first-round input >400000
- **THEN** the command exits 1

### Requirement: Security gates and conditional Security Review

CI SHALL run `pnpm audit:ci` and CodeQL for JS/TS on PRs and the default branch. When a change touches the security surface (File System Access, workers/postMessage, blob URLs, CSP/headers, dependency tags, or export), archive SHALL require a Security Review subagent pass without open critical/high findings; otherwise Security Review is not required.

#### Scenario: High-risk archive gate

- **WHEN** a change is security-tagged or modifies that surface
- **THEN** archive MUST NOT complete until Security Review is clean of critical/high findings

### Requirement: Docs, roadmap, and architecture pointers

The repo SHALL provide `docs/future-architecture.md` (target architecture including 60 fps; pieces land only via roadmap OpenSpec changes) and the roadmap layout (`docs/roadmap.md` index, per-item files, `docs/roadmap/RULES.md`, archive folders) managed only through `pnpm roadmap`. Item openness SHALL come from item-file done status. `pnpm roadmap check` SHALL run in unit tests (fully done but still-active milestone = warning, not hard fail). AGENTS SHALL link future-architecture and roadmap; `config.yaml` Doc budget SHALL mention the roadmap.

#### Scenario: Roadmap next without reading the index

- **WHEN** an agent runs `pnpm roadmap next`
- **THEN** it prints the first open non-contingency item with full scope without reading `docs/roadmap.md`

### Requirement: UI, scrollport, and exploratory lock-ins

Scrollport changes SHALL state no page-level H/V scroll (scroll only inside named ports) and MUST include Playwright page-fit helpers under `e2e/` — not `ui-review` alone. UI-scoped apply SHALL NOT complete without evidenced browser smoke (empty + happy + primary scroll/interact), `ui-review`, and Playwright for observable UX claims; virtualized lists MUST assert mid-scroll mounted-window coverage. Exploratory/MCP bugs fixed in a change SHALL land a Playwright test under `e2e/`. Repeated findings MUST become automated checks (or area SHALL / code comment if infeasible); no findings journal outside archives.

#### Scenario: UI apply blocked without smoke

- **WHEN** UI is in scope and empty/happy/scroll e2e or layout smoke is missing
- **THEN** implementation review MUST NOT pass and apply MUST NOT push/archive

### Requirement: Unattended roadmap flow

`/next-roadmap-item` (optional `<slug>`) SHALL run one open item end to end using `pnpm agent` composites, with mandates in `config.yaml` and `git-finish.mdc`. Security-tagged items continue and MUST pass Security Review before archive. Selection SHALL skip claimed/`[contingency]` work. Stop and ask only for: dirty tree, milestone review cut, intent conflict with spec/issue, or three red CI fix rounds. Token hygiene: no re-read of injected prompts/item after `roadmap next`; rules from instructions; `config.yaml` operations ≤ once; quiet verify/push; PR body once; issues as plain URLs. Batch independent tool calls; one validate per artifact stage. AGENTS SHALL document minimal MCP surface (unused servers disabled).

#### Scenario: Composite CLI and stop conditions

- **WHEN** the unattended command runs
- **THEN** preflight/finish/review-brief use `pnpm agent`, and only the defined stop conditions halt the run

### Requirement: Manual check and Docs/rules sync before archive

Before archive, changes SHALL complete Manual check (numbered steps under `## Manual test scenarios` in `tasks.md`, source for the PR section) and Docs/rules sync (README, AGENTS navigation, affected rules/skills, future-architecture, roadmap annotations). Archive MUST NOT proceed while those checklist items are unchecked. Stale contradicted docs are at least medium; roadmap overstatement is high. Duplicate full mandates across owners fail Docs/rules sync until one owner remains.

#### Scenario: Archive blocked without Manual check or Docs sync

- **WHEN** either checklist item is unchecked
- **THEN** archive MUST NOT proceed

### Requirement: Change sizing and deferred findings

Each change SHALL fit one apply context: ≤1 new subsystem and ≤8 implementation tasks (excluding Verification); line counts in `docs/roadmap/RULES.md`. Over-budget work and deferred blocking findings SHALL become `pnpm roadmap add --after` items (no vague follow-ups). Blocking (critical/high) findings from planning/implementation/Security/`adversarial-reviewer` SHALL be fixed or scheduled before archive; the PR body SHALL record verdicts and dispositions.

#### Scenario: Over-budget grows the roadmap

- **WHEN** propose/apply would exceed the budget
- **THEN** overflow is added with `pnpm roadmap add --after` and the current PR stays within limit

### Requirement: Agents must not weaken quality gates

Agents SHALL NOT weaken gates for any reason (exclusions, thresholds, retries, skip/fixme/fail, looser assertions). Only budgeted `// Stryker disable next-line <Mutator>[,…]: <reason>` (≥10 chars) within `mutation.disableBudget` is allowed. A `tasks.md` note SHALL NOT excuse a survivor. Red CI MUST be fixed with code/tests, not gate config.

#### Scenario: Loosening e2e to stabilize is forbidden

- **WHEN** an agent loosens an e2e assertion to quiet a flake
- **THEN** that is gate weakening and MUST NOT land

### Requirement: Out-of-scope failures and local push budget

A failure is out of scope only if the same test fails/flakes on unmodified `origin/main`; otherwise it is in scope for the current PR. Filing a roadmap/bug item MUST NOT make a red PR mergeable. Local push SHALL stop after at most two failed pre-push attempts and report in the PR description.

#### Scenario: Failure only with the change is in scope

- **WHEN** a test fails only with the change applied
- **THEN** the agent MUST fix it in the current PR

### Requirement: Pre-push verify:fast; e2e in CI

Lefthook pre-push SHALL run `pnpm check` only. Full Playwright e2e SHALL remain a required CI check. This split MUST NOT weaken coverage or mutation.

#### Scenario: Pre-push is check; CI still gates e2e

- **WHEN** an agent pushes with Lefthook installed
- **THEN** pre-push runs `pnpm check` and CI still requires Playwright e2e

### Requirement: Agent environment bootstrap

A POSIX-sourcable bootstrap script SHALL put Node (`.nvmrc`) and pnpm on PATH without writing `.tool-versions`. Highest matching asdf Node via `sort -V`; warn on major mismatch. AGENTS documents it in navigation form.

#### Scenario: Bootstrap without repo tool-versions

- **WHEN** the script is sourced with matching asdf Node installs
- **THEN** `pnpm` is on PATH, Node major matches `.nvmrc`, and no `.tool-versions` is created

### Requirement: Roadmap claim, worktrees, and done state

`pnpm roadmap next --slug` SHALL select an open active item (refuse unknown/done/contingency by default). Claimed/skip set SHALL include open PR heads, remote/local `feat|fix/*`, and worktree checkouts. Preflight `--slug` SHALL work in linked worktrees from `origin/main` without switching local `main`; refuse branches checked out elsewhere. Tooling SHALL use `git rev-parse --git-dir` / `--git-path` (not `root/.git`). Done state lives in the item file; `roadmap done` MUST NOT tick the shared index; sync applies ticks after merge. Milestone archive (`pnpm roadmap archive <M>`) is a post-merge operator step, not a side effect of `done`.

#### Scenario: Parallel dones do not conflict on index

- **WHEN** two branches each `roadmap done` a different item
- **THEN** neither edits the same index checkbox line

### Requirement: Finish merge, ports, and test-run budget

`pnpm agent finish` SHALL push (hooks on; no pre-push duplicate full verify; never `--no-verify`), create/update PR, print URL, and MUST NOT watch CI or invent commits. On conflict with `main`, finish MAY auto-resolve only pure-add `docs/roadmap.md` hunks and lockfile-only via `pnpm install` when `package.json` has no conflict, then `roadmap check`; any other conflict stops. No rebase/force-push. `E2E_PORT` (default 4173) SHALL isolate worktree preview. Local verify: targeted quiet unit + quiet changed e2e once when green; CI burn-in is flake authority; local `--repeat-each` ≤3 only after a local fail-then-pass. PR body metrics: wall time from `AGENT_RUN_STARTED_AT` or preflight marker; tokens when available.

#### Scenario: Finish success is PR URL without CI watch

- **WHEN** `pnpm agent finish` succeeds
- **THEN** output includes the PR URL and does not require `gh pr checks --watch`

### Requirement: Unified deterministic check entry

`pnpm check` SHALL run all independent deterministic gates in one fail-all invocation (optional pr-policy/diff-size/pr-body when present); Playwright stays separate. Default stdout: one `OK <check> (<time>)` per check, or capped problems + `.cache/checks/` log. Docs SHALL name `pnpm check` as the primary verify command. Preflight SHALL warn/merge-or-recreate stale branches behind `origin/main` (never rebase/force) and MAY list `quality/review-checklist.md` ids without embedding full checklist prose.

#### Scenario: Multiple failures reported together

- **WHEN** lint, unit, and roadmap each fail
- **THEN** `pnpm check` exits non-zero and reports all three in one run
