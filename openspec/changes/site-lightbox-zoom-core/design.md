## Decisions

1. Coordinates are viewport CSS px. `fitArea(view, insets)` = viewport minus `{top, bottom, side}` (floored at 0); `fitBox` = largest rect with the content ratio inside it, centred. Both exported: `clampPan` / `zoomAt` take the area. `fitInsets(hover)` picks `side` vs `sideTouch` for `site-lightbox`.
2. The zoom layer is `transform-origin: 0 0; translate(x, y) scale(z)` on the fitted box, so the painted rect is `box.x + x`, `box.w × z`.
3. `clampPan`, per axis: painted ≤ area → centred (`x = box.w·(1 − z)/2`, 0 at z = 1); else clamp so the painted rect covers the area. The Math.min/max form is idempotent.
4. `zoomAt` clamps `z × factor` to [1, 3], keeps the content point under (px, py) fixed, then `clampPan`. Keys / chip / double-click pass the area centre or the pointer.
5. `wheelFactor = exp(−deltaY × 0.01 × (deltaMode 1 ? 16 : 1))`; `settle` snaps z < 1.02 to `{1, 0, 0}`. Reuse `src/lib/clamp`.

## Touch-set & Test Plan

| Path                                         | Why                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/render/pagerZoom.ts`                    | the model                                                                        |
| `src/render/pagerZoom.test.ts`               | spec §2 fit table (incl. its 844 × 390 row), clamp branches, wheel modes, settle |
| `src/render/pagerZoom.pbt.test.ts`           | range, no pan at z = 1, clamp idempotent, anchor, round trip                     |
| `docs/roadmap/P5/site-lightbox-zoom-core.md` | stub filled from the brief                                                       |

- e2e: none (no UI).
