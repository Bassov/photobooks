# Design

## Context

See proposal.md. Filmstrip items are fixed 144×96 with cover crop (`FilmstripItem` / `Filmstrip.css`). `AssetSessionMeta.aspect` is written on import (`importPhotos` → `bookStore`) but UI never reads it; `subscribeGallery` skips meta-only updates. Import progress renders in `EditorShell` header via `ImportBatchState`. Decode stays in workers.

## Goals / Non-Goals

**Goals:** aspect-sized slots + full-photo thumbs; filmstrip status (count + progress); keep virtualization / rAF pacing / LoAF + page-fit.

**Non-Goals:** worker/thumb pipeline changes; DnD; new scrollports; new top-level capabilities.

## Touch-set

- `src/editor/thumbSlotSize.ts` — pure `thumbSlotSize(aspect)` → `{ width, height }` (fixed height 96; clamp width)
- `src/editor/FilmstripItem.tsx` + `Filmstrip.css` — parametrized size from aspect; `object-fit: contain`; test attrs for orientation/aspect
- `src/editor/Filmstrip.tsx` — prefix-sum widths for spacer / `translateX` / scroll→index; status strip child
- `src/editor/FilmstripStatus.tsx` (thin) — count + import progress (`data-testid`s: `filmstrip-status`, keep `import-progress`; `aria-live="polite"` on progress as today)
- `src/editor/EditorShell.tsx` — remove header progress; pass `ImportBatchState` into `Filmstrip` → `FilmstripStatus` as props
- `src/editor/bookStore.ts` — stable per-id aspect snapshot getter + subscribe that fires on meta (for `useSyncExternalStore`)
- `src/editor/bookStore.test.ts`, `src/editor/thumbSlotSize.test.ts`, `src/editor/Filmstrip.test.tsx` — aspect subscribe, size helper, variable-width spacer math
- `e2e/filmstrip.spec.ts` — portrait vs landscape widths, full preview, status count/progress; keep progressive + bulk LoAF scenarios

## Decisions

1. **Fixed height, width = clamp(h × aspect)** — Silhouette encodes orientation; contain shows full photo. Alternative (fixed outer box + letterbox only) rejected: cards would still look the same size.
2. **Clamp extremes** — min width ~48 (hit target), max ~288 (2× current landscape) so panoramas do not dominate. Within clamp, silhouette matches aspect; beyond clamp, contain letterboxes inside the clamped box.
3. **Prefix sums for virtualization** — Replace fixed `ITEM_STRIDE` / `ListLayout.rowSize` with per-item widths from the same helper (default aspect `1` until meta). Overscan when mapping scrollLeft→index. Keep `WINDOW_SIZE` / reveal pacing.
4. **Per-item meta subscribe** — Extend bookStore with a meta-aware subscribe/getAspect snapshot so items resize when decode updates aspect without forcing full gallery remounts on every meta flush.
5. **Progress on filmstrip** — Relocate `import-progress` into status strip via props from `EditorShell` (same `ImportBatchState` as today); keep pickers + error list in header. Status always shows count when gallery non-empty or import running.

## Tests

| Surface  | Public API                            | Assert                                                                    |
| -------- | ------------------------------------- | ------------------------------------------------------------------------- |
| Unit/PBT | `thumbSlotSize`                       | Portrait narrower than landscape; clamps; height fixed                    |
| Unit     | bookStore aspect subscribe            | Meta update notifies; snapshot stable when unchanged                      |
| E2E      | filmstrip items + status              | Distinct widths; status count; progress mid-import; page-fit / scrollport |
| E2E perf | existing bulk / progressive scenarios | zero LoAF and progressive count growth still pass                         |

Reuse `writeBulkImportFixtures`, `ensurePhotoFixtures`, `assertDocumentFitsViewport`, `assertNamedScrollport`, and existing filmstrip e2e helpers.

## Security

Blob/object URL thumb cache unchanged; no new File System Access or worker protocol.

## Risks / Trade-offs

- [Spacer/window desync with variable widths] → single size helper + prefix sums shared by spacer and items
- [Slot jump when aspect arrives] → acceptable; default aspect 1 until meta; no main-thread decode
- [LoAF under remounts] → keep REVEAL/FLUSH pacing; do not abort off-screen decode
