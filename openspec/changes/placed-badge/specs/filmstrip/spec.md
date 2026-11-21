## MODIFIED Requirements

### Requirement: Tone-only filmstrip selection and used badges

Selected filmstrip thumbs SHALL use tone fill `#CACACA` only (no black ring-select, no blue). Keyboard focus MAY show a gray a11y ring. Used/placed photos SHALL show a corner check (black/55 disc, white check; a `✓ N` count for 2+ places; no green, no blue). The dock bar is `#E1E1E1` with a plain head “Photos · {gallery} · {used} used” and quiet ghost sort/filter chips. Folder-import and filmstrip folder messages (“no new photos”, loose-file drop hints, skip summaries) MUST go to the editor status line, not toast popups.

#### Scenario: Selected thumb is tone-only

- **WHEN** the user selects a filmstrip photo
- **THEN** the selected thumb shows `#CACACA` background without a black selection ring

#### Scenario: Used mark is a corner check

- **WHEN** a gallery photo is placed on a frame
- **THEN** its thumb shows a corner check and the dock head counts it as used

## ADDED Requirements

### Requirement: Placed badge shows the photo in the book

A click on the placed badge, or Enter / double-click on a placed row, SHALL select the photo's next place in spread-list order (wrapping; frame, cover or endpaper), switching Masters to Pages, with no row selection, history step or zoom change. 2+ places show the pill `Placed i of n · <label>` for 2.5 s. Pick mode wins; a drag from the badge drags the photo.

#### Scenario: Start at the current spread

- **WHEN** the last jump is no longer the selection
- **THEN** the jump goes to the first place at or after the active spread, else the first place

#### Scenario: Cycle through two places

- **WHEN** a photo sits on pages 2–3 and page 4 and the user clicks its badge twice from page 1
- **THEN** the frame on page 4 is selected and the pill reads `Placed 2 of 2 · Page 4`; a third click selects pages 2–3's frame
