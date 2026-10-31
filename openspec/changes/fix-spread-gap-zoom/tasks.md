## Implementation

- [x] 1. Gap ratio: `STACK_GAP_RATIO`, `pasteboardGapPx`, scaled `pasteboardStridePx` / overscan / `stackHeightFitZoom` (unit + PBT). Evidence: `pasteboardWindow.test.ts`, `pasteboardView.test.ts`.
- [x] 2. Camera: drop `stackContentYAtZoom` / `stackSpreadHeightPx`; plain-scale anchoring keeps a gap point's relative offset (unit). Evidence: `camera.test.ts` PBT + pinch case.
- [x] 3. Pasteboard slot padding + `--slot-pad` from the scaled gap; page labels gated on gap px (unit). Evidence: `PageLabels.test.tsx`, `Pasteboard.view.test.tsx`.
- [x] 4. e2e: `spread-gap-zoom.spec.ts` (ratio constant at floor / Fit / zoomed-in, ≈ kit ratio at Fit); M23 tests move to the ratio contract. Evidence: 270/270 at `--repeat-each=30 --retries=0`; spread-view, look-parity-page-labels, design-canvas-camera, multi-drop-fill 780/780 at 30×.
- [x] 5. Spec sync: `pasteboard` Stack spacing, `spread-view` zoom-out floor wording. Evidence: deltas synced into `openspec/specs/{pasteboard,spread-view}/spec.md`.

## Manual test scenarios

1. Session book at 1440×900: Fit, zoom in 3×, zoom out to the floor — gap looks the same relative to the spreads; page numbers under spreads at Fit, never overlapping the next spread.
2. Drag a photo from the filmstrip over the gap between spreads at Fit — "Drop here for a new spread" pill shows in the gap.
