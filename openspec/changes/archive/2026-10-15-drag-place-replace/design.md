# Design

## Context

See proposal.md. `placeAsset` and `replaceAsset` already no-op on a bad id or a same-asset replace. `dispatchBookOp` is the editor write path. Committed zoom is baked into pasteboard `pxPerMm` and slot stride; the world transform is identity except during a zoom gesture. `SpreadView` stays presentational (`render-no-platform`).

## Goals / Non-Goals

**Goals:**

- One pure hit-test, one attribute toggle, one op per drop
- Keyboard uses the same place-or-replace choice as drop

**Non-Goals:**

- Inverting the in-gesture world transform
- Rebuilding the frame map while a drag is in progress

## Decisions

1. **Hit-test in `src/editor/dropTargets.ts`.** `buildDropIndex` runs at `dragstart`, not inside measured `dragover`. World Y is `slotIndex * stridePx` + `frameBox(rectMm, pxPerMm).top`. World X is `(worldWidth - spreadWidthPx) / 2` + `frameBox(...).left`, because `.pasteboard-slot` is `width: fit-content; margin-inline: auto`. `hitTestDrop` returns that frame's `spreadId` and `frameId` (topmost `z`) or nothing and allocates nothing. Alternative: `elementFromPoint` each `dragover` (rejected).

2. **Coordinates.** On `dragstart`, cache the scrollport origin (`getBoundingClientRect` once), build the index, and `querySelectorAll` `[data-frame-id]` into a map. Each `dragover` reads `scrollLeft` / `scrollTop` only, subtracts the cached origin, calls `hitTestDrop`, and map-looks up the element. If `pasteboard-world` has `data-gesture`, the hover clears and the drop is ignored.

3. **Hover outside React.** `setDropHover` removes `data-drop-hover` from the previous element and sets it on the next, returning immediately when the element is unchanged. `dragover` is wrapped in `measureHandlerSync('dragover', …)`.

4. **Payload.** `dragstart` sets `application/x-photobooks-asset` to the asset id and does not call `setDragImage`. File drags are ignored. Drop calls `placeAsset` when `assetId` is absent and `replaceAsset` otherwise, via `dispatchBookOp`.

5. **Selection store `gallerySelection.ts`.** A single asset id outside the document. `GridList` `selectionMode="single"` writes it. Frame activation with a null selection returns. `ConnectedSpreadView` passes optional controls into `SpreadView`: a frame is a `button` whose name is “Place photo” or “Replace photo”. Without controls, the frame stays a `div`.

6. **Badge.** `getPlacementCountSnapshot(assetId)` caches `placementCountByAsset` on book identity and returns a number. `FilmstripItem` shows “Placed” when the count is greater than zero. The photo is never removed from the gallery.

## Risks / Trade-offs

- [Scroll during drag shows frames absent from the dragstart map] → this gate is whole-book zoom, where every fixture spread is mounted; a mid-drag scroll can miss a new slot
- [Playwright HTML drag is flaky] → behavior e2e uses keyboard place/replace plus a synthesized `dragover` for the hover attribute; the perf scenario dispatches `dragover` and asserts the handler measure
- [`performance.measure` on every dragover] → same pattern as `wheel-zoom`; the budget includes that cost

## Touch-set

- `src/editor/dropTargets.ts`, `src/editor/gallerySelection.ts`, `src/editor/dropHover.ts`
- `src/editor/bookStore.ts` (placement snapshot only), `Filmstrip.tsx`, `FilmstripItem.tsx`, `Pasteboard.tsx`, `ConnectedSpreadView.tsx`
- `src/render/SpreadView.tsx` and `SpreadView.css` (`[data-drop-hover]` is an outline, not a fill)
- `e2e/drag-place.spec.ts`; `package.json` `perf` script so `-g frame-budget` includes that file
- `scripts/stryker-diff.mjs` `EDITOR_MUTATE`: `dropTargets.ts`

## Tests and UI

Public API: `buildDropIndex` / `hitTestDrop` (unit + fast-check: point inside a rect hits that frame; a miss hits nothing; higher `z` wins). Badge and no-op activation go through `Filmstrip` / `ConnectedSpreadView`. Reuse `e2e/fixtures/assertDocumentFitsViewport.ts` and the filmstrip photo fixtures. Do not add a second painter fixture.

E2E: empty gallery has no Placed badge and activating a frame leaves placeholders; two imported photos, keyboard place then replace, badges and both filmstrip items, `assertDocumentFitsViewport`. A synthesized drag sets `data-drop-hover` on one frame; a second point on another frame moves it and clears the first; a point that is not a frame clears it. The frame-budget scenario loads `/?fixture=painter&perf=1`, zooms until every spread is mounted, dispatches `dragover` across the book, and asserts zero LoAF and `dragover` p95.

Skill `ui-review` (layout smoke included) runs before push.
