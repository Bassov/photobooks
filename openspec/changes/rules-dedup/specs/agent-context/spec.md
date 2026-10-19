## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: One owner per agent rule

Each agent-facing mandate SHALL have one owner: OpenSpec per-change mandates and quality bar in `openspec/config.yaml`; finish/PR in `git-finish.mdc`; verify/flake in `testing.mdc`; product overview in `overview.mdc`; architecture in `architecture.mdc`; unattended pipeline in `next-roadmap-item.md`; navigation indexes in `AGENTS.md`. Rule-file sizes SHALL stay within `agentRules.budgets`.

#### Scenario: AGENTS does not restate verify or finish pipelines

- **WHEN** an agent reads root `AGENTS.md`
- **THEN** it MUST NOT contain a full duplicate of the testing verify loop or the git-finish commit/PR/CI-watch pipeline

#### Scenario: Rule budgets load from gates file

- **WHEN** `pr-policy` evaluates agent rule-file size limits
- **THEN** per-path `maxLines` and `maxChars` are taken from `quality/gates.json` `agentRules.budgets`
