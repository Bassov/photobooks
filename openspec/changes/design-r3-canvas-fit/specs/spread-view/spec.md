## MODIFIED Requirements

### Requirement: Selection labels stay the same

Frame controls MUST NOT expose a “Replace photo” label or Replace button. Labels for
move/swap remain: “Cancel move” on the move-source frame; “Swap photos” / “Move photo
here” on other frames while a move source exists; empty frames without a move source
stay “Place photo” placeholders. Gallery selection MUST NOT change frame control
labels into place/replace click targets — place/replace is filmstrip drag only.
A pointer click on the selected frame MUST keep it selected (kit); keyboard activation
of the move source cancels the move. Escape or a click on the empty pasteboard deselects.

#### Scenario: No Replace control

- **WHEN** a gallery photo is selected and the user inspects a filled or empty frame
  control
- **THEN** no control named “Replace photo” is present

#### Scenario: Click keeps the selected frame

- **WHEN** the user drops a photo on a frame and clicks that frame, or clicks a frame twice
- **THEN** the frame stays selected with the Photo inspector and 8 handles
