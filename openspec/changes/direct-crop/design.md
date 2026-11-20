## Decisions

1. Frame handles dispatch `resizeFrameKeepPhoto`; the preview runs the same core op and writes the photo box, so preview = commit. `resizeFrame` stays for layouts, inspector, multi-select.
2. `SpreadView` renders `PhotoChrome` (layer, grabber, photo handles, tag) on a selected own photo frame; layer and handles stay mounted, hidden by `visibility` (no hits) until shown. Screen px via `[data-camera-frame]`; fade `--duration-fast`.
3. New `src/editor/photoGesture.ts` (window capture, ahead of crop / frame gestures): pan via `panCrop`, scale via new `scaleCrop`; one per-gesture history key so `setFit` + `setCrop` is one step.
4. `scaleCrop` in `cropMath.ts`: window shrinks about the anchor; `clampCrop` floors; Fit past the cover ratio becomes Fill.
5. Kit colours via `color-mix` of `--paper` / `black` (css-tokens gate); tokens unchanged.

N/A: no heavy work (workers), no security surface.

## Touch-set & Test Plan

| File                                                      | Why                               |
| --------------------------------------------------------- | --------------------------------- |
| `src/editor/frameHandleGesture.ts`                        | keep-photo resize + preview       |
| `src/editor/photoGesture.ts`                              | grabber / ghost pan, corner scale |
| `src/editor/photoBoxPaint.ts`                             | photo box preview writes          |
| `src/editor/cropMath.ts`                                  | `scaleCrop`                       |
| `src/editor/EditorShell.tsx`                              | install the gesture               |
| `src/render/SpreadView.tsx`                               | `PhotoChrome`                     |
| `src/render/SpreadView.css`                               | chrome look                       |
| `src/render/PhotoChrome.tsx`                              | layer, grabber, photo handles     |
| `src/render/photoLayout.ts`                               | `grabberPoint`                    |
| `src/editor/bookHistory.ts`                               | keep-photo resize label           |
| `src/editor/bookHistory.test.ts`                          | label                             |
| `src/editor/frameHandleGesture.test.ts`                   | keep-photo op                     |
| `src/editor/photoGesture.test.ts`                         | pan / scale / Fit→Fill / undo     |
| `src/editor/cropMath.test.ts`                             | `scaleCrop` + PBT (anchor fixed)  |
| `src/render/SpreadView.chrome.test.tsx`                   | chrome render rules               |
| `e2e/direct-crop.spec.ts`                                 | Done-when e2e                     |
| `openspec/changes/direct-crop/specs/editor-shell/spec.md` | delta (pointer)                   |
| `openspec/changes/direct-crop/specs/pasteboard/spec.md`   | delta (direct crop)               |
