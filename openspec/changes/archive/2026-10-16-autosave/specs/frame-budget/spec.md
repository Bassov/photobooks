# Spec Delta

## ADDED Requirements

### Requirement: Autosave during continuous drag stays within frame budget

A throttled Playwright scenario MUST keep a continuous drag active while a dirty library-backed book would fire autosave debounce, and MUST fail on any long-animation-frame entry. Autosave MUST NOT start during the gesture; serialization MUST use background priority when idle. `pnpm perf` MUST run the same scenario and fail when frame pacing exceeds shared budgets.

#### Scenario: Continuous drag with pending autosave fails on a long animation frame

- **WHEN** a throttled scenario dirties a library-backed book, starts a continuous drag that spans the autosave debounce window, and records at least one long animation frame during that window
- **THEN** the scenario fails

#### Scenario: Local perf includes autosave-during-drag

- **WHEN** a developer runs `pnpm perf`
- **THEN** the autosave-during-drag scenario runs and the command fails when frame pacing exceeds the shared budgets
