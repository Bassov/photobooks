## Decisions

1. Core is the guard: `swapFrames` returns the same book when either frame is locked; `placeAsset` / `replaceAsset` leave a locked frame as is; `fillSpread` returns the same book for a locked target and skips locked empty frames.
2. Swap, unplace and gallery removal keep the frame's own fields: a `withoutPlacement(frame)` helper in `place.ts` strips `assetId` / `crop` / `fit` and keeps `locked`, `rotationDeg`, style, caption.
3. `resolveFrameActivation` takes `sourceLocked` and `target.locked` and returns `{ type: 'locked' }` instead of `swap`; `activateFrame` shows `STATUS_FRAME_LOCKED` and keeps the selection.

## Touch-set & Test Plan

| Path                                                             | Why                                |
| ---------------------------------------------------------------- | ---------------------------------- |
| `src/core/ops/place.ts`                                          | lock guard, keep frame fields      |
| `src/core/ops/fill.ts`                                           | skip locked frames                 |
| `src/core/ops/gallery.ts`                                        | reuse `withoutPlacement`           |
| `src/editor/dropTargets.ts`                                      | `locked` activation                |
| `src/editor/galleryDrop.ts`                                      | lock lookup + status (swap caller) |
| `src/core/ops/ops.test.ts`, `fill.test.ts`                       | core unit                          |
| `src/editor/dropTargets.test.ts`, `galleryDrop.activate.test.ts` | editor unit                        |

- Reuse: `frameLocked` (import only), `STATUS_FRAME_LOCKED`, `updateFrame`.
- Unit: locked source / target swap → same book; unlocked pair swaps keeping rotation, style; unplace / gallery removal keep `locked`; fill skips locked frames; `activateFrame` locked → status, book, history unchanged. e2e: `arrange-lock.spec.ts` locked source / target click swap refused, unlocked pair swaps.
- PR body: caller table for `swapFrames`, `placeAsset`, `replaceAsset`, `fillSpread`, `unplace` (context menu, Inspector: other lanes).
