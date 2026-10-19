## ADDED Requirements

### Requirement: Agent rule-file size budgets

`quality/gates.json` SHALL include `agentRules.budgets` (array of `{ path, maxLines, maxChars }` for each scoped rule file). `pr-policy` / `check-gate-ratchet` SHALL fail on head over-budget, missing budgeted path, or missing budget entry. Each `maxLines`/`maxChars` SHALL ratchet lower-stricter vs base.

#### Scenario: Over-budget rule file fails pr-policy

- **WHEN** a pull request’s head tree has a budgeted rule file whose line or character count exceeds the matching `agentRules.budgets` entry
- **THEN** the `pr-policy` check fails

#### Scenario: Current tree within budgets passes

- **WHEN** `pr-policy` compares a head tree whose every budgeted rule file is within its `maxLines` and `maxChars`
- **THEN** the rule-file budget rules do not fail for size alone

#### Scenario: Raised rule budget fails ratchet

- **WHEN** a pull request’s head `quality/gates.json` raises any `agentRules.budgets` `maxLines` or `maxChars` above the base value for the same path
- **THEN** the `pr-policy` check fails as a weaker gate

#### Scenario: Budgeted set covers scoped rule files

- **WHEN** head `agentRules.budgets` is evaluated
- **THEN** it MUST include entries for `AGENTS.md`, every `.cursor/rules/*.mdc`, `.cursor/commands/next-roadmap-item.md`, every `.cursor/agents/*.md`, and `openspec/config.yaml`
