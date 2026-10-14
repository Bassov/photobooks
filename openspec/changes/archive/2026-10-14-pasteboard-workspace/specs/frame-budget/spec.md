# Spec Delta

## ADDED Requirements

### Requirement: Pasteboard scroll stays within frame budget

A throttled Playwright scenario MUST scroll the painter-fixture pasteboard from top to bottom and MUST fail when any long-animation-frame entry is recorded during that scroll. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets.

#### Scenario: Fixture pasteboard scroll fails on a long animation frame

- **WHEN** a throttled scenario loads the painter fixture, scrolls the pasteboard from top to bottom, and records at least one long animation frame during that scroll
- **THEN** the scenario fails

#### Scenario: Local perf includes pasteboard scroll

- **WHEN** an operator runs `pnpm perf`
- **THEN** the pasteboard scroll scenario runs and the command fails when frame pacing exceeds the shared budgets
