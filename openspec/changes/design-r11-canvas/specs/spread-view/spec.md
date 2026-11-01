## MODIFIED Requirements

### Requirement: Page cut line

The painter SHALL draw each derived page cut at its mm offset on the same scale: on the canvas as the kit fold (3 % of the spread across, centred on the cut, transparent → 6 % black → transparent), on list thumbnails as a hairline.

#### Scenario: Interior spread shows the center cut

- **WHEN** a resolved spread includes a vertical page cut
- **THEN** the canvas fold is 3 % of the spread width, centred on that offset, at Fit and at 200 %

### Requirement: In-canvas chrome is locked to the zoom

Editor chrome painted inside a spread (the empty-frame "Drop photo" and missing-photo hints, the crop tag, the dpi and lock badges) SHALL keep its screen size at every zoom, including every frame of a live zoom gesture: hint icons 16 px, hint text 11 px; the fold scales with the spread (3 % of it). Its position SHALL follow the zoom transform in the same frame: hints stay centred in their frame, badges at their frame corner, and the fold centred on the spread centre. Chrome MUST NOT transition or re-layout after the gesture. The editor SHALL NOT show a frame size tag (width × height in mm) in any mode: select, drag, resize or crop.

#### Scenario: Wheel and ctrl-wheel zoom over an empty spread

- **WHEN** the user zooms out and back in with the wheel, then with a ctrl-wheel burst, over a spread with an empty frame
- **THEN** on every animation frame the placeholder icon is 16 × 16 screen px and the label 11 px, both centred in the frame within 0.5 px, and the fold centre equals the spread centre within 0.5 px and its width is 3 % of the spread
