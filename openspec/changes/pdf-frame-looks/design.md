## Decisions

1. Pure module `src/core/pdf/frameLookGeometry.ts` in frame-local mm (y down, under `frameMatrix`; `sheetMatrix` does mm→pt). It holds the look rects, the rounded-rect path segments and the inset-photo matrix.
2. Mat, stroke and radius clamp to half of the shorter side; the photo and stroke radii shrink by their inset (kit `FrameBody`).
3. Paint order: clip to the rounded frame box, mat fill, photo clipped to its inset box, stroke on top. Colours from the style, canvas defaults otherwise.
4. Photo: uniform cover scale about the frame centre (crop aspect kept, no distortion).
5. An empty look (no style, or all zeros) keeps today's operators.
6. Line width in mm; the CTM scales it to pt.

## Touch-set & Test Plan

| Path                                         | Why                               |
| -------------------------------------------- | --------------------------------- |
| `src/core/pdf/frameLookGeometry.ts`          | pure look geometry (new)          |
| `src/core/pdf/frameLookGeometry.test.ts`     | unit: look rects, path, matrix    |
| `src/core/pdf/frameLookGeometry.pbt.test.ts` | PBT: inset, clamps, stroke inside |
| `src/core/pdf/paintPdf.ts`                   | emit mat / clip / image / stroke  |
| `src/core/pdf/paintPdf.look.test.ts`         | unit: content-stream operators    |

- Reuse: `frameMatrix`, `imageMatrix`, `compose`, `PT_PER_MM`, paintPdf `rgb`.
- Tests: unit + PBT; no e2e (no UI); existing paintPdf tests unchanged.
