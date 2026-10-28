## ADDED Requirements

### Requirement: Fit & crop inspector section

The system SHALL show a "Fit & crop" inspector section for a selected filled frame with Fill|Fit, Zoom (100–400%), Pan X/Y (%), a Crop/Done toggle and Reset to cover (disabled at cover). Fit SHALL show the whole photo letterboxed and reset zoom and pan; the frame `fit` field is optional (absent = fill). While cropping the canvas SHALL show a grey (`--crop`) 2px outline with a "Crop · N%" tag and hide the black selection outline and handles; no crop chrome otherwise. Esc or Done SHALL exit.

#### Scenario: Crop from the inspector

- **WHEN** the user presses Crop on a selected photo
- **THEN** the grey overlay and tag appear and black selection chrome hides; Done removes them
