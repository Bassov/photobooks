# Spec Delta

## ADDED Requirements

### Requirement: Template switch and add spread stay within frame budget

A throttled Playwright scenario MUST switch the active spread's template and add a spread, and MUST fail when any long-animation-frame entry is recorded during that interaction. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets.

#### Scenario: Template switch and add spread fail on a long animation frame

- **WHEN** a throttled scenario switches the active spread's template, adds a spread, and records at least one long animation frame during that interaction
- **THEN** the scenario fails

#### Scenario: Local perf includes template switch and add spread

- **WHEN** an operator runs `pnpm perf`
- **THEN** the template switch and add-spread scenario runs and the command fails when frame pacing exceeds the shared budgets
