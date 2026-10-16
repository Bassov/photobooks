# Spec Delta

## ADDED Requirements

### Requirement: Save during drag stays within frame budget

A throttled Playwright scenario MUST trigger a library-backed book save while a drag gesture is active across the zoomed-out painter fixture (or an equivalent active drag), and MUST fail when any long-animation-frame entry is recorded during that window. Serialization MUST run at background priority so it does not block the drag path. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets.

#### Scenario: Save during drag fails on a long animation frame

- **WHEN** a throttled scenario starts a drag, triggers save for a library-backed book during that drag, and records at least one long animation frame during that window
- **THEN** the scenario fails

#### Scenario: Local perf includes save during drag

- **WHEN** an operator runs `pnpm perf`
- **THEN** the save-during-drag scenario runs and the command fails when frame pacing exceeds the shared budgets
