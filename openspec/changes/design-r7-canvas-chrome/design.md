## Decisions

1. Same transform source as the page numbers: in-world chrome that stays screen px carries `data-camera-frame`, so `usePasteboardCamera.writeCameraFrame` writes `--cam-scale` on it in the gesture rAF that sets the world transform, and clears it on settle. No port-wide var (it would restyle every spread per frame); only empty / missing hints, badges and page cuts get it.
2. Counter-scale with `scale: calc(1 / var(--cam-scale, 1))`, never a font-size / width re-layout. Empty / missing hints get one wrapper (`.spread-frame-hints`, kit gap 4) scaled about its centre; crop tag, dpi and lock badges scale about their frame corner (`transform-origin`); the page cut is centred on the cut (`translate: -50%`, like the kit gutter) and scaled to 1 screen px about its centre. Thumbs / Preview never set the var.
3. M52: delete the size tag span, `sizeLabel`, `writeSizeTag` and `.spread-frame-size-tag`.

## Touch-set & Test Plan

- Files: `src/render/SpreadView.tsx` (markers stay inside the existing `SpreadFrame` / page-cut markup), `src/render/SpreadView.css`, `src/editor/frameHandleGesture.ts`, `docs/design.md`; unit tests beside them and `src/editor/ConnectedSpreadView.test.tsx`; e2e `e2e/design-r7-canvas-chrome.spec.ts` (new), `canvas-frame-chrome`, `inspector`, `preview-no-overlays` specs.
- Reuse: `writeCameraFrame` unchanged.
- Tests: unit — wrapper and camera-frame markers (none on thumbs), no size tag. e2e — per-rAF samples through an 8-step wheel zoom out/in and a ctrl-wheel burst (kit icon / label px, centring and fold ≤ 0.5 px); select / drag / resize / crop with no size tag or `mm` text.
