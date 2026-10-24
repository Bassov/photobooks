## MODIFIED Requirements

### Requirement: Continuous zoom stays within frame budget

A throttled Playwright scenario MUST zoom the painter fixture continuously from the whole book to 400% of physical size and back, including working-preview swaps after the gesture settles and the remount of newly visible spreads through zoom-out gesture end, and MUST fail when any long-animation-frame entry is recorded or when the wheel-zoom handler p95 exceeds the shared budget. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets. The scenario MUST NOT require a tier larger than the working preview (1280).

#### Scenario: Whole-book zoom fails on a long animation frame

- **WHEN** a throttled scenario zooms the painter fixture from the whole book to 400% and back, working-preview swaps included, and records at least one long animation frame during that zoom
- **THEN** the scenario fails

#### Scenario: Wheel zoom fails when the handler is slow

- **WHEN** a throttled scenario zooms the painter fixture and the wheel-zoom handler p95 exceeds the shared budget
- **THEN** the scenario fails

#### Scenario: Local perf includes continuous zoom

- **WHEN** an operator runs `pnpm perf`
- **THEN** the continuous zoom scenario runs and the command fails when frame pacing exceeds the shared budgets

#### Scenario: Working preview is inside the zoom window

- **WHEN** a throttled scenario zooms the painter fixture to 400% and the gesture has settled
- **THEN** a filled frame shows the working preview (1280) during that scenario window when available, and the scenario still fails if a long animation frame was recorded

#### Scenario: Zoom-out settle remount is inside the LoAF window

- **WHEN** a throttled scenario runs a continuous zoom-out burst through the default settle, waits until the zoom gesture has ended, and waits until paced remount of newly visible spreads completes
- **THEN** the scenario fails if any long animation frame was recorded during that burst-through-paced-remount window
