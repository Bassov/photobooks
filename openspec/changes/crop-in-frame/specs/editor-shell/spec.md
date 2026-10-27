## ADDED Requirements

### Requirement: Non-destructive crop in frame

The system SHALL let the user enter crop mode on a filled frame by double-click and pan (drag), zoom (wheel, inspector slider) and nudge (arrows, Shift ×10) the photo inside it, never below cover and never past the image edges. Preview SHALL be a transform in rAF; one crop op SHALL be committed at gesture end (bursts of wheel / nudge / slider coalesce into one history step). "Reset to cover" SHALL restore zoom 1 centered. Esc SHALL exit crop mode. A zoom beyond the current tier SHALL request a higher tier. The crop SHALL persist across save and reload.

#### Scenario: Pan then reload

- **WHEN** the user double-clicks a filled frame and drags the photo, then saves and reloads
- **THEN** the frame shows the panned crop

#### Scenario: Reset and exit

- **WHEN** the user zooms in, presses "Reset to cover", then Esc
- **THEN** the crop is zoom 1 centered and crop mode is off

#### Scenario: Zoom floor

- **WHEN** the user wheels out past cover
- **THEN** zoom stays at 1 with no empty edges
