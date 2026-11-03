## MODIFIED Requirements

### Requirement: Frame context menu, arrange shortcuts and lock

Right-clicking an editor frame (or Shift+F10 on a focused one) SHALL select it and open a menu with Bring to front, Bring forward, Send backward, Send to back and Lock / Unlock, dispatching the same ops as the inspector Arrange buttons and lock toggle; a move that cannot change the order is hidden, never disabled. Ctrl/Cmd+] / Ctrl/Cmd+[ SHALL bring the selected frame forward / send it backward, with Shift to the front / back, and Ctrl/Cmd+Shift+L SHALL toggle its lock. A locked frame SHALL NOT move, resize, start a photo drag or accept a dropped photo; unlocking restores all of these. With 2 or more frames selected, right-clicking one of them SHALL keep the selection; the menu, the arrange shortcuts and Lock SHALL act on the whole set (one `reorderFrames` / `setFramesLocked` undo step; Lock locks all when any is unlocked, else unlocks all) and the menu SHALL add "Delete N frames".

#### Scenario: Send behind from the menu

- **WHEN** the user right-clicks the top of two overlapping frames and picks Send to back
- **THEN** the other frame is on top at the overlap and the inspector shows layer 1 for the clicked frame

#### Scenario: Locked frame ignores drag and drop

- **WHEN** a frame is locked and the user drags it or drops a filmstrip photo onto it
- **THEN** its box is unchanged, it shows no resize handles and it stays empty; after Ctrl/Cmd+Shift+L a drag moves it

### Requirement: Shift+click multi-frame selection

The frame selection SHALL be a set of frames on one spread. Shift+click (or Shift+Enter / Shift+Space on a focused frame) on frame F SHALL toggle F when the selection is on F's spread, else select F alone; it SHALL NOT swap, move, place or enter crop. One frame left SHALL be the single selection (handles, Photo inspector). With 2 or more selected: every selected frame keeps its outline, no frame shows handles, a 1 px dashed `--color-mark` group box SHALL surround the axis-aligned union of the selected frames (rotated corners included) 4 screen px out, with no fill and no pointer events, hidden in crop mode and Preview; selected frames SHALL NOT start a photo drag; the inspector SHALL show the Multiple selection context; a plain click or double-click on a frame SHALL select it alone first (no swap); Esc SHALL clear the selection; Delete / Backspace SHALL delete every selected frame, locked ones included (as the Delete frame button), in one undo step labelled "Delete N frames", instead of unplacing the focused frame.

#### Scenario: Shift+click two filled frames

- **WHEN** the user clicks a filled frame and Shift+clicks a second filled frame on the same spread
- **THEN** both frames are pressed, no handles show, the group box is their union plus 4 px on each side and both photos stay in place

#### Scenario: Delete a set with a locked frame

- **WHEN** three frames are selected, one of them locked, and the user presses Delete
- **THEN** all three frames are removed and one Undo restores them

## ADDED Requirements

### Requirement: Multi-selection inspector

With 2 or more frames selected on a book spread the inspector SHALL show the kit Multiple selection context: `layers` icon, title "Multiple selection", meta `N frames · ` plus the non-zero parts of `K photo(s)`, `E empty`, `T text`; then expanded Align & distribute, expanded Arrange and "Delete N frames", and no single-frame section. Align & distribute SHALL be three groups (left / horizontal centers / right, top / vertical centers / bottom, distribute horizontally / vertically) of 28×28 buttons that wrap; Align needs 2 and Distribute 3 unlocked frames, else the button stays focusable with `aria-disabled` and the reason ("Needs 2 unlocked frames" / "Select 3 or more unlocked frames") as its tooltip. Align and Distribute SHALL move only unlocked frames, against the bounds of the unlocked frames, in one undo step. The caption SHALL read `Selection W × H mm` (all selected) plus ` · L locked, skipped` only when L > 0. Arrange SHALL label `layers a–b of M`; front / back move the selected block keeping its order; forward / backward move each selected frame past the next unselected one.

#### Scenario: Distribute three frames

- **WHEN** three unlocked frames are selected and the user clicks Distribute horizontally
- **THEN** the gaps between them are equal and one Undo restores all three

#### Scenario: Align skips a locked frame

- **WHEN** three frames are selected, one locked, and the user clicks Align left edges
- **THEN** the two unlocked frames share a left edge, the locked frame stays put and the caption ends "· 1 locked, skipped"
