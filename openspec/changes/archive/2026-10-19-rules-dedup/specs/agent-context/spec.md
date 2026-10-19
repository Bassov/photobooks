## MODIFIED Requirements

### Requirement: Agent navigation map

The repository SHALL provide a root `AGENTS.md` that maps source capabilities to specs and lists verify/security commands as reference only, without per-change workflow mandates. `AGENTS.md` size SHALL stay within `quality/gates.json` `agentRules.budgets` (not a separate soft line cap).

#### Scenario: Module map present

- **WHEN** an agent opens `AGENTS.md`
- **THEN** it can locate capability directories under `src/` and their corresponding `openspec/specs/` paths

#### Scenario: AGENTS size enforced by gate

- **WHEN** `pr-policy` evaluates `AGENTS.md`
- **THEN** its line and character counts MUST be within the matching `agentRules.budgets` entry

### Requirement: Docs/rules sync

When a change alters behavior, commands, CI output, the module map, or the roadmap item, apply SHALL keep README, AGENTS (navigation only; size via `agentRules.budgets`, no checklists), affected rules/skills, future-architecture notes, and roadmap annotations aligned with what shipped. Agents MUST NOT add an alwaysApply rule without merging or removing another. Each agent-facing rule SHALL have exactly one owner; non-owners MAY keep a one-line pointer only. Repeated findings become checks via `openspec/config.yaml` quality bar, not new prose elsewhere, unless a check is infeasible.

#### Scenario: Verification checklist names Docs/rules sync

- **WHEN** an agent creates `tasks.md` for a change
- **THEN** the Verification checklist MUST include a Docs/rules sync item naming those update targets

#### Scenario: Archive blocked without Docs/rules sync

- **WHEN** archive is requested while the Docs/rules sync checklist item is unchecked
- **THEN** archive MUST NOT proceed

#### Scenario: Implementation reviewer fails stale docs

- **WHEN** `openspec-implementation-reviewer` reviews a change whose diff contradicts README, AGENTS, rules, or future-architecture, or overstates the roadmap item
- **THEN** a stale contradicted statement is at least medium, and a roadmap line that overstates what shipped is high

#### Scenario: Duplicate mandate across rule surfaces fails review intent

- **WHEN** the same normative mandate is fully restated in two owners among AGENTS, alwaysApply rules, project commands, agents, or OpenSpec config
- **THEN** Docs/rules sync is incomplete until one owner remains and other copies are deleted or reduced to a pointer

### Requirement: Agent environment bootstrap

The repository SHALL provide a POSIX-sourcable bootstrap script that puts Node matching `.nvmrc` and pnpm on PATH for non-interactive shells without writing a `.tool-versions` file into the tree. `AGENTS.md` SHALL document it in navigation form (size via `agentRules.budgets`, no checklist).

#### Scenario: Bootstrap without repo tool-versions

- **WHEN** an agent sources the bootstrap script in a clean non-interactive shell that has asdf Node installs matching `.nvmrc`
- **THEN** `pnpm` is on PATH, `node -v` reports the `.nvmrc` major, and no `.tool-versions` file is created under the repository root

#### Scenario: Highest matching Node when several installs exist

- **WHEN** multiple asdf Node installs share the `.nvmrc` major
- **THEN** the bootstrap selects the highest version via `sort -V`, sets `ASDF_NODEJS_VERSION` only when that install exists, and MUST NOT use lexical `ls` order alone

#### Scenario: Warn on Node major mismatch

- **WHEN** after bootstrap `node -v` major does not match `.nvmrc`
- **THEN** the script MUST warn on stderr

## ADDED Requirements

### Requirement: One owner per agent rule

Each agent-facing mandate SHALL have one owner: OpenSpec per-change mandates and quality bar in `openspec/config.yaml`; finish/PR in `git-finish.mdc`; verify/flake in `testing.mdc`; product overview in `overview.mdc`; architecture in `architecture.mdc`; unattended pipeline in `next-roadmap-item.md`; navigation indexes in `AGENTS.md`. Rule-file sizes SHALL stay within `agentRules.budgets`.

#### Scenario: AGENTS does not restate verify or finish pipelines

- **WHEN** an agent reads root `AGENTS.md`
- **THEN** it MUST NOT contain a full duplicate of the testing verify loop or the git-finish commit/PR/CI-watch pipeline

#### Scenario: Rule budgets load from gates file

- **WHEN** `pr-policy` evaluates agent rule-file size limits
- **THEN** per-path `maxLines` and `maxChars` are taken from `quality/gates.json` `agentRules.budgets`
