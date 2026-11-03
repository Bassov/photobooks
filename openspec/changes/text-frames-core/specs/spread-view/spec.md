## MODIFIED Requirements

### Requirement: Paint frames from resolved geometry

The painter SHALL draw each resolved item as a frame from its millimeter rect at a fixed px/mm scale, stacked by z-order. A text item SHALL paint its text in its style (mm × px/mm) clipped to whole lines, as `button.spread-frame[data-kind="text"]` when controlled, on the canvas, thumbnails and Preview. Photo captions SHALL use font size 3.1 mm × px/mm.

#### Scenario: Frame matches millimeter rect

- **WHEN** a resolved item has a rect in millimeters
- **THEN** the painted frame's position and size equal that rect × the fixed scale

#### Scenario: Text frame paints whole lines

- **WHEN** a caption text frame 10 mm high is painted in the editor or as a thumbnail
- **THEN** its text node is 2 × 4.34 mm × px/mm high at 3.1 mm × px/mm; empty text shows `Empty text` only with a control
