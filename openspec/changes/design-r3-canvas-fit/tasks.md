## Implementation

- [x] 1. M9: `fitSpreadZoomFor` (book-wide Fit on the widest spread) in `pasteboardCameraFit.ts` + unit tests; `usePasteboardCamera` uses it for Fit spread; pasteboard spec delta.
- [x] 2. M3/M4: `resolveFrameActivation` + `isPointerActivation` (`dropTargets.ts`) keep the selected frame on a pointer click; `activateFrame` (`galleryDrop.ts`) ← `ConnectedSpreadView.tsx` ← `SpreadView.tsx` click detail; unit tests (`dropTargets`, `ConnectedSpreadView`, `SpreadView`); spread-view spec delta.
- [x] 3. e2e `design-r3-canvas-fit.spec.ts` (Fit across spreads, manual zoom kept; drop/click/click selection, Escape, empty pasteboard, double-click crop); existing specs updated only where they encode the old behaviour.

## Manual test scenarios

1. 1440×900, new 30×30 book at Fit: click page 1, spread 2–3, last page in Pages — each spread inside the pasteboard, label "Fit".
2. Zoom out once, click spread 2–3 — zoom kept, label shows a percent.
3. Drop a photo on a frame, click the same frame twice — Photo inspector and 8 handles stay; Escape deselects; double-click enters crop.
