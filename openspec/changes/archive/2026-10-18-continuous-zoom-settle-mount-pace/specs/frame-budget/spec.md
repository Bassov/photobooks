## MODIFIED Requirements

### Requirement: Continuous zoom stays within frame budget

A throttled Playwright scenario MUST zoom the painter fixture continuously from the whole book to 400% of physical size and back, including zoom-tier switches after the gesture settles and the remount of newly visible spreads through zoom-out gesture end, and MUST fail when any long-animation-frame entry is recorded or when the wheel-zoom handler p95 exceeds the shared budget. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets.

#### Scenario: Whole-book zoom fails on a long animation frame

- **WHEN** a throttled scenario zooms the painter fixture from the whole book to 400% and back, tier switches included, and records at least one long animation frame during that zoom
- **THEN** the scenario fails

#### Scenario: Wheel zoom fails when the handler is slow

- **WHEN** a throttled scenario zooms the painter fixture and the wheel-zoom handler p95 exceeds the shared budget
- **THEN** the scenario fails

#### Scenario: Local perf includes continuous zoom

- **WHEN** an operator runs `pnpm perf`
- **THEN** the continuous zoom scenario runs and the command fails when frame pacing exceeds the shared budgets

#### Scenario: Tier switch is inside the zoom window

- **WHEN** a throttled scenario zooms the painter fixture to 400% and the gesture has settled
- **THEN** a filled frame's tier changes during that scenario window and the scenario still fails if a long animation frame was recorded

#### Scenario: Zoom-out settle remount is inside the LoAF window

- **WHEN** a throttled scenario runs a continuous zoom-out burst through the default settle and waits until the zoom gesture has ended so newly visible spreads remount
- **THEN** the scenario fails if any long animation frame was recorded during that burst-through-gesture-end window
