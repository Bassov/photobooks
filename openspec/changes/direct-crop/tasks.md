## Implementation

- [x] 1. `scaleCrop` in `cropMath.ts` (anchor / centre, Fill cover floor, Fit floor + switch to Fill past cover) with unit + PBT tests
- [x] 2. `photoBoxPaint.ts`: write / restore the photo box of a frame button from a crop (plain and turned photos)
- [x] 3. `frameHandleGesture`: `resizeFrameKeepPhoto` with live photo-box preview; unit tests
- [x] 4. `SpreadView` `PhotoChrome` (layer, grabber, photo handles, gesture tag) + CSS look, show / hide timing; render tests
- [x] 5. `photoGesture.ts` (grabber / ghost pan, corner scale, one history step, Fit→Fill) installed in `EditorShell`; unit tests
- [x] 6. `e2e/direct-crop.spec.ts` (Done when)

## Manual test scenarios

1. Select a full-bleed photo frame, drag its right edge in: the photo stays put; Undo once restores.
2. Hover the grabber: ghost, outline and 4 round handles fade in; drag the grabber: the photo pans; leave: the layer hides.
3. Drag a photo corner out: the photo grows about the opposite corner; set Fit, grow past cover: the inspector reads Fill.
4. Select an empty frame: no grabber, no photo handles.
