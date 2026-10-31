## Decisions

1. **Fit = widest spread of the book (kit wins over the brief).** Rendered `#/demo` draws page 1 and spread 2–3 at the same Fit scale; `viewport.tsx` fits `SW = 2·PAGE` for every spread. The product fitted the active spread's own width, so spread 2–3 overflowed under a stale "Fit". A refit on `activeIndex` change would also fire on IntersectionObserver scroll updates and jump the zoom mid-scroll; a book-wide Fit needs no refit and keeps a manual zoom. New pure `fitSpreadZoomFor` in `pasteboardCameraFit.ts` (mutated); `usePasteboardCamera` passes `stackWidth` (wiring only).
2. **A pointer click on the selected frame keeps it selected (kit `canvas.tsx` `onFrameDown`).** `resolveFrameActivation` gets `pointer`: same frame + pointer → `noop`. Keyboard / AT activation (`detail === 0`) keeps the `aria-pressed` toggle ("Cancel move"). `SpreadView` passes the click event; `isPointerActivation` lives in `dropTargets.ts`. Escape and an empty-pasteboard click still deselect; drag-swap and double-click crop untouched.
3. No new tokens or primitives (`docs/design.md` N/A).

## Touch-set & Test Plan

- Files: `src/editor/pasteboardCameraFit.ts`, `usePasteboardCamera.ts`, `dropTargets.ts`, `galleryDrop.ts`, `ConnectedSpreadView.tsx`, `src/render/SpreadView.tsx`; specs `pasteboard`, `spread-view`.
- Reuse: `fitZoom` / `fitViewportSize`, existing `noop` activation.
- Unit: `pasteboardCameraFit.test.ts`, `dropTargets.test.ts`, `ConnectedSpreadView.test.tsx` / `SpreadView.test.tsx` (click detail wiring).
- e2e `design-r3-canvas-fit.spec.ts`: Fit across spreads + manual zoom kept; click/click selection; Escape; double-click crop. Skill `ui-review` before push.
