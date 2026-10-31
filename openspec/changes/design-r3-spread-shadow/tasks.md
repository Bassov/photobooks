## Implementation

- [x] 1. M35: slot `overflow-clip-margin` + gesture-time paint clip off; shadow counter-scaled mid-gesture (`design-r3-spread-shadow.spec.ts`).
- [x] 2. M36: `STACK_GAP_RATIO` 72 / 588; unit + e2e ratios updated (`pasteboardWindow.test.ts`, `stackGap.ts`).
- [x] 3. M37: page numbers 8 px under the page, 11 px, centred; `--cam-scale` from the camera; threshold 19 px (`PageLabels.test.tsx`, `cameraGesture.test.tsx`).

## Manual test scenarios

1. Session book, 1440 × 900: Fit, zoom out to ≤ 19 %, zoom in to ≥ 138 %: soft shadow, no band; numbers 8 px under each page.
2. Ctrl+wheel zoom: numbers and shadow do not jump while zooming or when it settles.
