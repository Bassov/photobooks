## Decisions

1. **Row bands.** `rowBands(w, h, texels, cell)` (`gl/canvas.ts`) splits a canvas into whole-cell row bands of at most `texels`. `grain` takes an optional band `[y0, y1)`; noise rows renew every `cell` rows from `y0`.
2. **Grain:** `GRAIN_BAND_PX = 2^18`, 8 tasks for a 2× page (1200 × 1600). The face source and the open book's endpaper (`endpaperCanvas`, now async) yield before each band.
3. **Paint:** Chromium rasterizes a canvas's pending draws at the end of the task, so a face paints in `PAINT_BAND_PX = 2^19` bands (4 at 2×): clip to the band, `paintPage` unchanged, yield between bands.
4. **No paint in the caller's task:** `pump` starts with `yieldTask()`, so reader `focus` / `face` calls never paint inline.

## Touch-set & Test Plan

| File                              | Why                                                 |
| --------------------------------- | --------------------------------------------------- |
| `src/site/book/gl/canvas.ts`      | `rowBands`, banded `grain`, shared `nextTask`       |
| `src/site/book/gl/faces.ts`       | banded paint + grain, first yield                   |
| `src/site/book/gl/open.ts`        | banded endpaper grain                               |
| `src/site/book/gl/canvas.test.ts` | band math, banded grain, `nextTask`                 |
| `src/site/book/gl/faces.test.ts`  | clip per band, order, dispose mid-paint / mid-grain |

- Callers unchanged and green: `roomGl.ts` (`openReaderGl`, `openCurlGl`), `reader.tsx` / `turn.tsx`, `open.ts`.
- e2e: `e2e/gl-faces-probe.spec.ts` as is.
