# Spec Delta

## ADDED Requirements

### Requirement: Frame drag stays within frame budget

A throttled Playwright scenario MUST drag a frame across the zoomed-out painter fixture and MUST fail when any long-animation-frame entry is recorded or when the dragover handler p95 exceeds the shared budget. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets.

#### Scenario: Zoomed-out frame drag fails on a long animation frame

- **WHEN** a throttled scenario drags a frame across the zoomed-out painter fixture and records at least one long animation frame during that drag
- **THEN** the scenario fails

#### Scenario: Frame dragover fails when the handler is slow

- **WHEN** a throttled scenario drags a frame across the zoomed-out painter fixture and the dragover handler p95 exceeds the shared budget
- **THEN** the scenario fails

#### Scenario: Local perf includes frame drag

- **WHEN** an operator runs `pnpm perf`
- **THEN** the zoomed-out frame drag scenario runs and the command fails when frame pacing exceeds the shared budgets
