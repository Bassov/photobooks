## ADDED Requirements

### Requirement: Resolve exposes frame and photo rotation

A resolved item's `rotation` SHALL equal the frame `rotationDeg` (0 when absent); `rectMm` stays the unrotated rect. When the crop has non-zero `quarterTurns` the resolved item SHALL expose `photoQuarterTurns`, and the source crop rect SHALL be computed in the turned image (aspect inverted for odd turns) and mapped back to unturned source space. A non-zero crop `straightenDeg` SHALL be exposed as `straightenDeg`.

#### Scenario: Turned photo

- **WHEN** a frame crop has `quarterTurns` 1
- **THEN** the item has `photoQuarterTurns` 1 and a source crop rect inside the unit square
