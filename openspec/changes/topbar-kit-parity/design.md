## Decisions

1. The top bar sits outside the pasteboard, but fit/zoom-to need its viewport. `cameraStore` gains `registerCameraCommands` / `getCameraCommands`; `Pasteboard` registers the existing `usePasteboardCamera` actions (plus `zoomTo` = existing `placeZoom`, `fitSpreadZoom` = existing fit). No new zoom math.
2. Menu percents are physical percent (`physicalZoom() * N / 100`), matching the old `formatZoomPercent` readout. Label is "Fit" when the zoom equals the fit-spread zoom (0.5 % tolerance), else the percent; `data-zoom-percent` keeps the numeric readout for e2e.
3. `MenuKeyboard` added to `src/ui/Menu` (react-aria `Keyboard`, `ml-auto`, opacity .6).
4. The Present button becomes the Preview pill (testid `present` kept). Export / Publish / disabled Preview removed. `Ctrl+0` is a hint only, as in the kit (no hotkey exists today).
5. Tokens: existing `BAR`, `FIELD`, `SUB`, `T`; grayscale only.

## Touch-set & Test Plan

- Files: `EditorTopBar.tsx`, `CameraBar.tsx` (deleted), `Pasteboard.tsx`, `usePasteboardCamera.ts`, `cameraStore.ts`, `editorChromePanels.ts`, `EditorShell.css`, `ui/Menu.tsx|css`.
- Reuse: camera store, `placeZoom`, `fitZoom`, `formatZoomPercent`, `Button`, `Menu`.
- Tests: unit — label Fit/N%, each entry calls the commands, key hints, tooltip strings, no placeholders; CameraBar tests move to a test-only bar. e2e — `topbar-kit-parity.spec.ts` (200% / Fit, hint, Preview, no camera-bar); zoom helpers for spread-view / drag-swap.
