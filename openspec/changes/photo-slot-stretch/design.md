## Decisions

1. Cause: the paint snapshot crops with `sessionMeta.aspect ?? 1`, a placeholder `1` after reload / list-first import until thumb hydrate or decode restores it. A tier that paints first gets a square-source crop box, so a portrait is stretched.
2. Fix: `tierDisplay` already decodes each tier before the swap; it passes `naturalWidth/Height` to a new `restoreAspectFromImage` in `previewAspect.ts`, which replaces only a placeholder aspect (no real dims, >1 % off) and keeps placeholder dims, so a real decode still wins and DPI never uses tier pixels. Tiers are already upright. All SpreadView callers (canvas, Pages thumbs, Masters, cover, Presentation) share the snapshot; `SpreadView.tsx` untouched (#407).
3. Guard: `.spread-frame-image { object-fit: cover }` crops, never distorts, while box and bitmap still disagree (thumb before any tier). No new tokens or primitives; one CSS property. Empty frames: N/A.

## Touch-set & Test Plan

| File                                  | Why                       |
| ------------------------------------- | ------------------------- |
| `src/editor/previewAspect.ts`         | `restoreAspectFromImage`  |
| `src/editor/tierDisplay.ts`           | report decoded tier size  |
| `src/render/SpreadView.css`           | `object-fit: cover` guard |
| `src/editor/previewAspect.test.ts`    | unit                      |
| `src/editor/photoSlotAspect.test.tsx` | DOM, fails on main        |
| `e2e/place-fit-aspect.spec.ts`        | e2e                       |

- Unit: placeholder replaced; real dims / within 1 % / zero size kept.
- DOM: portrait and EXIF-6 photos in landscape and portrait frames, 320 → 1280 swap, then replace; box aspect = natural ±1 %.
- e2e: settled tier and replace-in-filled-frame on canvas + Pages thumbs.
