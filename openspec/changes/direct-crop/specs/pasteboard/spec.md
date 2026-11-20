## ADDED Requirements

### Requirement: Direct crop on a selected photo frame

A selected single photo frame (not text, empty, locked, being edited or in crop mode) SHALL be cropped without a mode, one history step per gesture: frame handles resize the frame with the photo fixed on the page (Fill scales it up only to keep cover), the grabber or the shown ghost pans it, and corner photo handles scale it aspect-locked about the opposite corner (Alt: centre). Fill never goes below cover; Fit may shrink to fit and growing past cover switches to Fill.

#### Scenario: Edge crop keeps the photo

- **WHEN** the user drags the right handle of a selected photo frame inward, then presses Undo
- **THEN** the photo keeps its place and size on the page, and one Undo restores the frame

#### Scenario: Fit grows into Fill

- **WHEN** the user drags a photo corner of a Fit frame outward past cover
- **THEN** the photo grows about the opposite corner and the inspector shows Fill

### Requirement: Direct crop photo layer

The photo layer (ghost at .3, extent outline, 4 corner handles) SHALL fade in on grabber or photo-handle hover and during a photo gesture (frame handles hidden, "Crop · N%" tag), and hide 400 ms after the pointer is > 12 px outside the photo; chrome is screen px, the fade instant under reduced motion. Hit order: photo handle, frame handle, grabber, ghost, frame body; the wheel keeps panning the canvas.

#### Scenario: Hover shows the layer

- **WHEN** the user hovers the grabber of a selected photo frame
- **THEN** the ghost, the extent outline and 4 photo handles are painted
