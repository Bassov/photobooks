## ADDED Requirements

### Requirement: In-canvas chrome is locked to the zoom

Editor chrome painted inside a spread (the empty-frame "Drop photo" and missing-photo hints, the crop tag, the dpi and lock badges, and the page cut / fold) SHALL keep its screen size at every zoom, including every frame of a live zoom gesture: hint icons 16 px, hint text 11 px, the fold 1 screen px. Its position SHALL follow the zoom transform in the same frame: hints stay centred in their frame, badges at their frame corner, and the fold centred on the spread centre. Chrome MUST NOT transition or re-layout after the gesture. The editor SHALL NOT show a frame size tag (width × height in mm) in any mode.

#### Scenario: Wheel and ctrl-wheel zoom over an empty spread

- **WHEN** the user zooms out and back in with the wheel, then with a ctrl-wheel burst, over a spread with an empty frame
- **THEN** on every animation frame the placeholder icon is 16 × 16 screen px and the label 11 px, both centred in the frame within 0.5 px, and the fold centre equals the spread centre within 0.5 px

#### Scenario: Selected frame has no size tag

- **WHEN** a frame is selected, dragged, resized or cropped
- **THEN** no size tag exists and no "mm" text shows under the frame
