## ADDED Requirements

### Requirement: Multi-photo drop fills frames or creates a spread

Dropping several photos on a spread frame SHALL place them in gallery order into the target frame (replacing it if filled) and the remaining empty frames, as one history step; photos beyond free frames SHALL stay unplaced and the status SHALL report how many. Dropping them in the gap between spreads (or after the last) SHALL insert one new spread using the best-fit template with the photos placed in order, as one history step.

#### Scenario: Four photos on a 4-grid

- **WHEN** four photos are dropped on an empty 4-grid spread
- **THEN** all four frames fill in gallery order

#### Scenario: Two portraits between spreads

- **WHEN** two portraits are dropped between two spreads
- **THEN** a new two-portrait spread appears there; Undo removes it

#### Scenario: More photos than frames

- **WHEN** five photos are dropped on a 4-grid
- **THEN** one stays unplaced and the status reports 1 left

#### Scenario: Filled target

- **WHEN** photos are dropped on a filled frame
- **THEN** it is replaced and the rest go to empty frames
