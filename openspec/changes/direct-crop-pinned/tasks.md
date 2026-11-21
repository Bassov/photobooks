## Implementation

- [ ] 1. Rotate snap / 15° step helper + rotate knob and chip on direct photo frames (frameHandleMath, frameHandleGesture, SpreadView).
- [ ] 2. Pinned chrome: PhotoChrome in crop mode (layer shown, focusable photo handles, focus ring), overlay tag vs photo tag.
- [ ] 3. Photo gesture on the pinned frame; pure pinned key helper (Tab cycle, screen-px nudge, one step per press) in cropGesture; wheel burst stays one step.
- [ ] 4. Small frames: mid handles < 40 px, grabber < 64 px.
- [ ] 5. Unit tests + `e2e/direct-crop-pinned.spec.ts`; adjust knob assertions in pinned e2e specs.

## Manual test scenarios

1. Select a photo frame, drag the rotate knob: the chip follows with the angle; Shift steps 15°; near 90° it snaps.
2. Double-click the photo: photo layer, grabber and 4 handles stay; Tab cycles the handles; arrows nudge; wheel zooms; Esc exits.
3. Shrink a frame to ~50 × 30 px: no grabber, no mid handles on the short sides.
