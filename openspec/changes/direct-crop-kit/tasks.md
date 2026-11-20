## Implementation

- [x] 1. Crop math in `uikit/src/sandbox/model.ts`: `photoRect`, `cropFor`, `keepPhoto`, `scalePhoto`, `panPhoto` (b3beecaf).
- [x] 2. `FrameChrome` in `canvas.tsx`: grabber, photo layer (ghost, extent outline, 4 photo handles), hit order, show / hide timing, small-frame rules (b3beecaf; e2e `kit-direct-crop.spec.ts`).
- [x] 3. Gestures: frame handles crop with keep-photo, photo corner scale (Alt centre, Fit → Fill), grabber / ghost pan, rotate chip + snaps (b3beecaf; e2e).
- [x] 4. Pinned state: layer + photo handles + grabber, frame handles hidden, Tab cycle, arrow nudge 1 / 10 px (b3beecaf; e2e).
- [x] 5. `#/demo` steps: new `editor-photo-layer-hover`, `editor-photo-scaled`, `editor-frame-cropped-by-edge`; `editor-frame-selected` / `editor-crop-mode` re-shot (walk: 84 steps, baseline in `.cache/agent/demo-branch`).
- [x] 6. `e2e/kit-direct-crop.spec.ts` for every Done-when line (6 tests green).

## Manual test scenarios

1. Kit `#/demo`: select a photo frame → grabber at the photo centre; hover it → ghost + 4 round handles.
2. Drag a frame edge handle → the photo stays put; drag a photo corner → the photo scales, aspect locked.
3. Double-click the frame → pinned: Crop tag, no frame handles; Tab cycles the handles; arrows nudge; Esc exits.

Agent manual-qa drives the prod editor only (kit not reachable). Scenarios 1–3 are covered by the `#/demo` capture walk (shots 16, 19–22 checked) and `e2e/kit-direct-crop.spec.ts`.
