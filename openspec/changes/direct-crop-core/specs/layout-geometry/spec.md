## MODIFIED Requirements

### Requirement: Free frame ops

The system SHALL expose pure ops to add an empty frame (rejected when either edge is under 5 mm; appended above existing frames), remove frames, and set one frame's rect. Each changed spread MUST drop its `templateId`; a no-op MUST return the same book. `resizeFrameKeepPhoto` SHALL set one frame's rect under the `resizeFrame` guards and recompute its crop so the photo's page placement is unchanged; in Fill, when the photo would no longer cover the frame, it SHALL scale the photo up by the minimum about the frame edge or corner opposite the moved one; in Fit there is no cover scale.

#### Scenario: Add detaches the template

- **WHEN** a frame is added to a spread bound to a template
- **THEN** the spread has no `templateId` and the new frame has the highest `z`

#### Scenario: Keep-photo resize

- **WHEN** a filled frame is shrunk from its right edge with `resizeFrameKeepPhoto`
- **THEN** the photo's page rect is unchanged and only the crop window narrows
