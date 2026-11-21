## MODIFIED Requirements

### Requirement: Undo / redo of layout edits

The editor SHALL keep an in-memory snapshot history of spreads and title: each book op is one step (consecutive title edits coalesce), up to 100 steps with the oldest evicted, a new edit drops redo steps, and gallery / assets / import state are never rolled back. Undo/redo SHALL be available as top-bar buttons (`data-testid` `undo` / `redo`, disabled when empty) and as Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, Ctrl+Y outside text fields. Loading another book clears history. On an interior spread in Pages mode, outside text fields, text edit, the spreads list, the filmstrip dock and Site preview, Ctrl/Cmd+C / X / V / Shift+V / D SHALL copy ("Copied frame" / "Copied N frames", 2 s), cut (unlocked frames), paste (+5 mm steps while taken; Shift: in place) and duplicate (repeating the last moved duplicate's offset) the frame selection as one undo step each ("Cut / Paste / Duplicate frame" / "… N frames"), select the new frames and scroll them into view without a zoom change. With the Select tool, a press with Alt held on a frame (cursor `copy`) SHALL duplicate it, or the selection it belongs to, past a 3 px slop: ringed clones at opacity .85 follow the pointer, the release is one duplicate step at the snapped delta that Ctrl/Cmd+D repeats, and Esc adds nothing; Alt pressed after the press only bypasses snapping.

#### Scenario: Placement is one step

- **WHEN** a photo is placed in a frame and the user presses Undo, then Redo
- **THEN** the frame is empty after Undo and holds the photo again after Redo
