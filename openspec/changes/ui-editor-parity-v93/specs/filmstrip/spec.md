## ADDED Requirements

### Requirement: Tone-only filmstrip selection and used badges

Selected filmstrip thumbs SHALL use tone fill `#CACACA` only (no black ring-select, no blue). Keyboard focus MAY show a gray a11y ring. Used/placed badges on thumbs SHALL use black/ink styling (not a blue brand fill). Folder-import and filmstrip folder messages (“no new photos”, loose-file drop hints, skip summaries) MUST go to the editor status line, not toast popups.

#### Scenario: Selected thumb is tone-only

- **WHEN** the user selects a filmstrip photo
- **THEN** the selected thumb shows `#CACACA` background without a black selection ring

#### Scenario: Placed badge is black ink

- **WHEN** a gallery photo is placed on a frame
- **THEN** the filmstrip Placed badge uses black/ink styling
