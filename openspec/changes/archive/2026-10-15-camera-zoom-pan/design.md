# Design

## Context

See proposal.md. `Pasteboard` virtualizes with `pasteboardWindow` on `pasteboard-scroll`. `SPREAD_PX_PER_MM` (0.5) is camera zoom 1.

## Goals / Non-Goals

**Goals:**

- Session camera: pointer zoom, key zoom, fit controls, Space pan, physical-size indicator
- Wheel and pinch write one transform in rAF and do not re-render the pasteboard
- Stride and frame pixels update once when the gesture settles

**Non-Goals:**

- Image tiers, LOD bitmaps, rulers, drag, crop, history
- Storing zoom in the book document

## Decisions

1. **Zoom multiplies `SPREAD_PX_PER_MM`.** Physical 100% is `(96 / 25.4) / SPREAD_PX_PER_MM`. The indicator shows `round(zoom / physical100 * 100)`. `fitZoom({ mode: 'contain' | 'width' })` sizes the active spread. `fitStackZoom` is the minimum. Maximum is at least 400% physical and at least the active-spread fit results.

2. **Pure math in `src/editor/camera.ts`.** `zoomAtPoint` keeps a viewport anchor fixed from committed scroll and zoom: `translate(anchor * (1 - ratio)) scale(ratio)` with origin `0 0`. Pinch is two Pointer Events: the distance ratio is the factor and the midpoint is the anchor, then the same function. Those pointer moves call `preventDefault`, and the scrollport uses `touch-action: none` while two pointers are down so the pinch only scales `pasteboard-world`.

3. **Only `pasteboard-world` transforms.** `cameraStore` splits committed zoom from live zoom. `Pasteboard` subscribes to the committed snapshot (zoom plus anchor scroll). `CameraBar` subscribes to live zoom. The wheel listener is non-passive, calls `preventDefault` only for Ctrl/Cmd, and wraps its sync body in `measureHandlerSync('wheel-zoom')`. `will-change: transform` is set only during the gesture. After ~80 ms idle, commit zoom and anchor scroll together so `pasteboardWindow` uses that `scrollTop` in the same render as the new stride, then clear the transform. `+` / `-` multiply by `2 ** 0.25` through `zoomAtPoint` at the viewport center. Fit buttons center the active spread. Both write live and committed zoom together. Space+drag sets scroll in rAF.

4. **Committed zoom resizes layout once.** `SpreadView` takes `pxPerMm` (default `SPREAD_PX_PER_MM`). `ConnectedSpreadView` receives `SPREAD_PX_PER_MM * committedZoom`. Slot stride uses that scale. At `fitStackZoom` the fixture window includes all 40 spreads. While the transient transform is set, mounted slots skip `content-visibility` so a parent transform cannot drop their paint.

5. **`CameraBar` sits with `SpreadTemplateBar`, outside the scrollport.** Buttons: Fit spread, Fit width, 100%. The indicator is text, not a live region. Same `:focus-visible` ring as the template bar. `usePasteboardCamera` owns listeners so `Pasteboard` does not absorb the gesture math.

## Risks / Trade-offs

- [Whole-book zoom mounts ~40 spreads] → stop if the LoAF gate fails; do not start `far-zoom-lod` here
- [Spreads stay hidden until settle] → mid-wheel only scales what is already mounted
- [Non-passive wheel on the scrollport] → return immediately unless Ctrl/Cmd is set

## Touch-set

- `src/editor/camera.ts`, `src/editor/cameraStore.ts`, `src/editor/CameraBar.tsx`, `src/editor/usePasteboardCamera.ts`
- `src/editor/Pasteboard.tsx`, `src/editor/ConnectedSpreadView.tsx`, `src/editor/EditorShell.css`
- `src/render/SpreadView.tsx` (`pxPerMm` only)
- `e2e/spread-view.spec.ts`
- Tests beside the new modules and `SpreadView.test.tsx`

## Tests and UI

Public API: `zoomAtPoint`, `fitZoom`, `fitStackZoom`, and physical percent (unit + fast-check). One unit asserts a two-pointer pinch matches `zoomAtPoint`. Live zoom alone does not change the mounted slot count.

Reuse `assertDocumentFitsViewport` and `assertNamedScrollport(page, 'pasteboard-scroll', …)`. E2E covers empty book, 100% / fit width / fit spread, pointer and key zoom that keep the anchor content point fixed, pinch, Space+drag, horizontal scroll inside the pasteboard, and the 40-spread fixture. The frame-budget scenario reaches at least 400% physical and back; `pnpm perf` runs it and checks wheel-zoom p95.

Skill `ui-review` (layout smoke included) runs before push.
