## ADDED Requirements

### Requirement: Shift+click multi-frame selection

The frame selection SHALL be a set of frames on one spread. Shift+click (or Shift+Enter / Shift+Space on a focused frame) on frame F SHALL toggle F when the selection is on F's spread, else select F alone; it SHALL NOT swap, move, place or enter crop. One frame left SHALL be the single selection (handles, Photo inspector). With 2 or more selected: every selected frame keeps its outline, no frame shows handles, a 1 px dashed `--color-mark` group box SHALL surround the axis-aligned union of the selected frames (rotated corners included) 4 screen px out, with no fill and no pointer events, hidden in crop mode and Preview; selected frames SHALL NOT start a photo drag; the inspector SHALL show its no-selection state; a plain click or double-click on a frame SHALL select it alone first (no swap); Esc SHALL clear the selection; Delete / Backspace SHALL delete every selected frame, locked ones included (as the Delete frame button), in one undo step labelled "Delete N frames", instead of unplacing the focused frame.

#### Scenario: Shift+click two filled frames

- **WHEN** the user clicks a filled frame and Shift+clicks a second filled frame on the same spread
- **THEN** both frames are pressed, no handles show, the group box is their union plus 4 px on each side and both photos stay in place

#### Scenario: Delete a set with a locked frame

- **WHEN** three frames are selected, one of them locked, and the user presses Delete
- **THEN** all three frames are removed and one Undo restores them
