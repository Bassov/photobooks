## MODIFIED Requirements

### Requirement: Parent items and override copies on the canvas

On the editor canvas (not thumbs, Preview or export) every inherited parent item SHALL wear a 1 px dashed `--parent-soft` outline at constant screen px that never takes the pointer; a plain press keeps falling through it, and a plain press over an uncovered parent item SHALL announce `Parent item from “<name>”. Ctrl+Shift+click to override it on this spread.` (⌘⇧ on Mac) in the live region only. With the Select tool, a primary press with Shift and Ctrl or ⌘ SHALL hit test the spread geometrically, through own frames: the topmost rotation-aware override copy under the press first, else a parent guide within 4.5 screen px, else the topmost rotation-aware parent frame. A copy hit SHALL select that copy and, past 3 px, move it, with no new override and no history step for the press. A frame hit SHALL override it (`overrideParentFrame`, "Override parent item"), select the copy and, past 3 px, move it as a separate history step; Alt stays the snap bypass. A copy SHALL paint in the parent layer (above inherited items, below every own frame) as an interactive frame (select, move, resize, rotate, photo drop, lock) without z-order moves; a selected copy's ring and handles SHALL sit above every own frame, visible and grabbable. Its "override" badge (`unlink2`) SHALL show in full when the frame is at least 74.42 × 24.84 screen px, icon-only at 26 × 24.84 px, else hidden, refitting live through a zoom gesture. Delete on a lone selected copy SHALL hide its parent item ("Hide parent item").

#### Scenario: Override through an own frame

- **WHEN** an own frame covers the Master A logo and the user Ctrl+Shift-presses the logo and drags 30 px right
- **THEN** a copy with the override badge moves 30 px right in the parent layer, the own frame is unchanged, and Undo twice first returns the copy to the parent position, then removes it

#### Scenario: Reselect a covered copy

- **WHEN** a copy sits under an own frame, the user clicks away, then Ctrl+Shift-presses the copy
- **THEN** the copy is selected with the Undo label unchanged, and a drag past 3 px moves it as one history step
