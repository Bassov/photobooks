## ADDED Requirements

### Requirement: Free frame ops

The system SHALL expose pure ops to add an empty frame (rejected when either edge is under 5 mm; appended above existing frames), remove frames, and set one frame's rect. Each changed spread MUST drop its `templateId`; a no-op MUST return the same book.

#### Scenario: Add detaches the template

- **WHEN** a frame is added to a spread bound to a template
- **THEN** the spread has no `templateId` and the new frame has the highest `z`
