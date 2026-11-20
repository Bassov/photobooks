## Implementation

- [ ] 1. Crop math in `uikit/src/sandbox/model.ts`: `photoRect`, `cropFor`, `keepPhoto`, `scalePhoto`.
- [ ] 2. `FrameChrome` in `canvas.tsx`: grabber, photo layer (ghost, extent outline, 4 photo handles), hit order, show / hide timing, small-frame rules.
- [ ] 3. Gestures: frame handles crop with keep-photo, photo corner scale (Alt centre, Fit → Fill), grabber / ghost pan, rotate chip + snaps.
- [ ] 4. Pinned state: layer + photo handles + grabber, frame handles hidden, Tab cycle, arrow nudge 1 / 10 px.
- [ ] 5. `#/demo` steps: `editor-frame-selected`, `editor-crop-mode` kept; new `editor-photo-layer-hover`, `editor-photo-scaled`, `editor-frame-cropped-by-edge`.
- [ ] 6. `e2e/kit-direct-crop.spec.ts` for every Done-when line.

## Manual test scenarios

1. Kit `#/demo`: select a photo frame → grabber at the photo centre; hover it → ghost + 4 round handles.
2. Drag a frame edge handle → the photo stays put; drag a photo corner → the photo scales, aspect locked.
3. Double-click the frame → pinned: Crop tag, no frame handles; Tab cycles the handles; arrows nudge; Esc exits.
