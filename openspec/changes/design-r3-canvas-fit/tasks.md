## Implementation

- [x] 1. M9: `fitSpreadZoomFor` (book-wide Fit on the widest spread) in `pasteboardCameraFit.ts` + unit tests; `usePasteboardCamera` uses it for Fit spread; pasteboard spec delta.
- [x] 2. M3/M4: `resolveFrameActivation` + `isPointerActivation` (`dropTargets.ts`) keep the selected frame on a pointer click; `activateFrame` (`galleryDrop.ts`) ← `ConnectedSpreadView.tsx` ← `SpreadView.tsx` click detail; unit tests (`dropTargets`, `ConnectedSpreadView`, `SpreadView`); spread-view spec delta.
- [x] 3. e2e `design-r3-canvas-fit.spec.ts` (Fit across spreads, manual zoom kept; drop/click/click selection, Escape, empty pasteboard, double-click crop); existing specs updated only where they encode the old behaviour.
- [x] 4. M9 rework: `Pasteboard` refits at Fit on a trim change (stale 30 × 30 Fit on a new 19 × 23 book); `pickActiveSpread` tie rule documented; unit `Pasteboard.view.test.tsx`, `pasteboardWindow.test.ts`; e2e asserts an explicit Fit spread keeps the zoom.

## Manual test scenarios

1. 1440×900, new 30×30 book at Fit: click page 1, spread 2–3, last page in Pages — each spread inside the pasteboard, label "Fit".
2. Zoom out once, click spread 2–3 — zoom kept, label shows a percent.
3. Drop a photo on a frame, click the same frame twice — Photo inspector and 8 handles stay; Escape deselects; double-click enters crop.

- problem: `pnpm agent manual-qa` (rig) fails all 3 at entry — its `start-session` click is intercepted by the welcome `<header>` (`WelcomeScreen.tsx`, unchanged vs main); rig defect, not this change. Scenarios checked in Chromium with the e2e fixtures instead:
- OK 1: 1440×900, new 19 × 23 book: Fit 59 %, spread 2–3 848 × 513 inside the 928 × 732 port, centred, label "Fit" (main: 55 %, stale until an explicit Fit); 30 × 30 and 19 × 23 page 1 → 2–3 → last page in `design-r3-canvas-fit.spec.ts`.
- OK 2: zoom out, click spread 2–3 → zoom kept, label shows the percent (`design-r3-canvas-fit.spec.ts`).
- OK 3: drop, click the same frame → 8 handles, inspector "Photo" (main: 0 handles, "Spread"); click/click, Escape, empty pasteboard, double-click crop in `design-r3-canvas-fit.spec.ts`.
