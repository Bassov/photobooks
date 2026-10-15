# Spec Delta

## ADDED Requirements

### Requirement: Gallery drag stays within frame budget

A throttled Playwright scenario MUST drag across the zoomed-out painter fixture and MUST fail when any long-animation-frame entry is recorded or when the dragover handler p95 exceeds the shared budget. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets.

#### Scenario: Zoomed-out drag fails on a long animation frame

- **WHEN** a throttled scenario drags across the zoomed-out painter fixture and records at least one long animation frame during that drag
- **THEN** the scenario fails

#### Scenario: Dragover fails when the handler is slow

- **WHEN** a throttled scenario drags across the zoomed-out painter fixture and the dragover handler p95 exceeds the shared budget
- **THEN** the scenario fails

#### Scenario: Local perf includes gallery drag

- **WHEN** an operator runs `pnpm perf`
- **THEN** the zoomed-out gallery drag scenario runs and the command fails when frame pacing exceeds the shared budgets
