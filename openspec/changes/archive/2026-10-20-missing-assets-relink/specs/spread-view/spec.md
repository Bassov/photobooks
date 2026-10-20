## ADDED Requirements

### Requirement: Missing-asset hatched frame

When a placed frame's asset is marked `missing` by the relink status store, the frame SHALL render a hatched (pattern) placeholder distinct from an empty-frame placeholder, and MUST NOT show a stale preview image for that asset. Empty frames (no `assetId`) keep the existing empty placeholder.

#### Scenario: Missing asset shows hatch

- **WHEN** a frame references an asset id whose relink status is `missing`
- **THEN** the frame shows a hatched missing placeholder and no photo image

#### Scenario: Empty frame unchanged

- **WHEN** a frame has no asset id
- **THEN** the frame shows the empty placeholder, not the missing hatch
