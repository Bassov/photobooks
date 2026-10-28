## ADDED Requirements

### Requirement: Frame tool draws, moves and snaps free frames

With the Frame tool, dragging on bare spread paper SHALL draw an empty image frame, committed only when both edges are at least 5 mm; the new frame is selected and the tool returns to Select. With the Select tool, dragging an empty frame SHALL move it. Delete / Backspace SHALL remove the selected empty frame. Each edit clears the spread's template binding and is one undo step. While drawing or moving, edges and centers SHALL snap (8 px pull) to other frames, guides and equal gaps through an anchor index, showing a grey snap line with a `snap · <kind>` label; Alt suppresses snapping. There is no toast on create.

#### Scenario: Draw, then delete

- **WHEN** the user presses F, drags at least 5 mm on bare paper and presses Delete
- **THEN** a selected empty frame appears with the Select tool active, and Delete removes it

#### Scenario: Too small

- **WHEN** the drag is under 5 mm on either edge
- **THEN** no frame is created

#### Scenario: Alt skips snap

- **WHEN** a draw corner is within the pull distance of a frame edge and Alt is held
- **THEN** no snap line shows and the corner is not moved
