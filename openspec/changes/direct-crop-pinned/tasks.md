## Implementation

- [x] 1. Rotate snap / 15° step helper + rotate knob and chip on direct photo frames (frameHandleMath, frameHandleGesture, SpreadView). Evidence: `frameHandleMath.test.ts` `snapRotationDeg`, `frameHandleGesture.test.ts` chip test, e2e `direct-crop-pinned.spec.ts` rotate tests (6f84e666).
- [x] 2. Pinned chrome: PhotoChrome in crop mode (layer shown, focusable photo handles, focus ring), overlay tag vs photo tag. Evidence: `SpreadView.chrome.test.tsx` pinned test, e2e pinned test (outline, hit tests, focus ring).
- [x] 3. Photo gesture on the pinned frame; pure pinned key helper (Tab cycle, screen-px nudge, one step per press) in cropGesture; wheel burst stays one step. Evidence: `cropKeys.test.ts`, `cropGesture.test.ts` (Tab, screen px, undo per press), `photoGesture.test.ts` pinned corner test, e2e pinned test (Tab order, 1 / 10 px, wheel).
- [x] 4. Small frames: mid handles < 40 px, grabber < 64 px. Evidence: `SpreadView.chrome.test.tsx` 39 / 40 / 63 / 64 px and one-side cases, e2e 50 × 30 frame.
- [x] 5. Unit tests + `e2e/direct-crop-pinned.spec.ts`; adjust knob assertions in pinned e2e specs. Evidence: `design-r2-inspector.spec.ts` (knob now present), `crop-in-frame.spec.ts` (one undo per gesture).

## Manual test scenarios

1. Select a photo frame, drag the rotate knob: the chip follows with the angle; Shift steps 15°; near 90° it snaps.
2. Double-click the photo: photo layer, grabber and 4 handles stay; Tab cycles the handles; arrows nudge; wheel zooms; Esc exits.
3. Shrink a frame to ~50 × 30 px: no grabber, no mid handles on the short sides.

manual-qa (`pnpm agent manual-qa`): harness problem for 1–3 — `start-session` click intercepted by the welcome-screen header (known harness issue), no scenario exercised. Evidence instead: `e2e/direct-crop-pinned.spec.ts` (1: rotate chip + Shift / snap tests; 2: pinned crop test; 3: 50 × 30 frame test), all passing locally.
