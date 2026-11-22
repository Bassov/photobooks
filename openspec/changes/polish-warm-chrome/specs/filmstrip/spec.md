## MODIFIED Requirements

### Requirement: Tone-only filmstrip selection and used badges

Selected filmstrip thumbs SHALL use tone fill `#CACACA` only (no black ring-select, no blue). Keyboard focus MAY show a gray a11y ring. Used/placed photos SHALL show a corner check (black/55 disc, white check; a `✓ N` count for 2+ places; no green, no blue). The dock bar is the warm chrome `#E3E1DD` with a plain head “Photos · {gallery} · {used} used” and quiet ghost sort/filter chips. Folder-import and filmstrip folder messages (“no new photos”, loose-file drop hints, skip summaries) MUST go to the editor status line, not toast popups.

#### Scenario: Selected thumb is tone-only

- **WHEN** the user selects a filmstrip photo
- **THEN** the selected thumb shows `#CACACA` background without a black selection ring

#### Scenario: Used mark is a corner check

- **WHEN** a gallery photo is placed on a frame
- **THEN** its thumb shows a corner check and the dock head counts it as used
