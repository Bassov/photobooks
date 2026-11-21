## Decisions

1. M123: `PhotoChrome` reports its shown state (`onShownChange`, false on unmount); `SpreadFrame` applies `CROP_Z_BOOST` while it shows.
2. M124: pinned Esc (`cropGesture.ts`) exits crop, reselects the target (`setFrameSource`) and stops propagation; the editor Esc deselects on the next press.
3. M125: `scaleCrop` bounds the scale by the zoom limits so the anchor stays put.
4. M126: Tab focuses photo handles with `focus({ preventScroll: true })`.
5. UI: no new tokens; existing photo-handle / ghost primitives (docs/design.md); skill `ui-review` before push.

## Touch-set & Test Plan

| Path                                    | Why                         |
| --------------------------------------- | --------------------------- |
| `src/render/PhotoChrome.tsx`            | shown callback              |
| `src/render/SpreadView.tsx`             | z boost                     |
| `src/editor/cropMath.ts`                | scale bounds                |
| `src/editor/cropGesture.ts`             | Esc, preventScroll          |
| `src/render/SpreadView.chrome.test.tsx` | unit: hover z boost         |
| `src/editor/cropMath.test.ts`           | unit: limits keep the photo |
| `src/editor/cropGesture.test.ts`        | unit: Esc, Tab focus        |
| `e2e/direct-crop-pinned.spec.ts`        | e2e: M123–M126              |
| `e2e/crop-in-frame.spec.ts`             | e2e: Esc keeps selection    |

- Reuse: `CROP_Z_BOOST`, `setFrameSource`, `pixelsAt`, `sizedPhotoFrame`.
