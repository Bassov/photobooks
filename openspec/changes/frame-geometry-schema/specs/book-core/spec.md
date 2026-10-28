## ADDED Requirements

### Requirement: Frame rotation, lock and photo rotation fields

A frame MAY carry `rotationDeg` (number, degrees about its center; absent = 0) and `locked` (boolean; absent = unlocked). A frame crop MAY carry `quarterTurns` (integer 0–3 clockwise; absent = 0) and `straightenDeg` (number in [-45, 45]; absent = 0). Migrating schemaVersion 3 to 4 SHALL set `schemaVersion` to 4 and set `rotationDeg` to 0 on frames lacking it, without setting `locked` or crop rotation.

#### Scenario: v3 book migrates

- **WHEN** a valid schemaVersion 3 document is migrated
- **THEN** the result has `schemaVersion` 4, every frame has `rotationDeg` 0 and no `locked`, and the document parses as the current shape
