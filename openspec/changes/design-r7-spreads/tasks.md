## Implementation

- [ ] 1. Core `getSinglePageSide` / `getSpreadSlotPageCount` with unit tests.
- [ ] 2. M45 canvas: spread-wide slot with the page on its side; page labels in halves; shadows, drop index and camera centring follow the side.
- [ ] 3. M45 list: slot-aspect row box, `SpreadThumb` on its half, page-1 label at 50 %.
- [ ] 4. M46 `pageLabel(i, count)` for the single last page; unit tests.
- [ ] 5. M49 gap 104 / 588 (`STACK_GAP_RATIO`, `e2e/fixtures/stackGap.ts`, M26/M36 spec text).
- [ ] 6. M49 pill: one line, constant size, centred, `newSpreadPillFits` threshold; labels stay visible during a drag.
- [ ] 7. `e2e/design-r7-spreads.spec.ts` (M45 rects vs kit, M46 labels, M49 pill and gap).

## Manual test scenarios

1. 1440 × 900, 19 × 23 book: page 1 is on the right half of its canvas slot and list card; the last page on the left half; labels `1 · 2–3 · … · N`.
2. Drag a filmstrip photo over the gap at Fit and at 300 %: one-line pill centred in the gap, page numbers above it; zoom out until the pill disappears.
