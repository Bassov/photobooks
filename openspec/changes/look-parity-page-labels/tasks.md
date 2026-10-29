## Implementation

- [x] 1. Page labels under each spread (`PageLabels`, `pageLabelsModel`) — `PageLabels.test.tsx`
- [x] 2. Frame drop overlay + chip (`dropChipLabel`, `data-drop-label`) and idle dashed hint — `PageLabels.test.tsx`
- [x] 3. Gap band restyled to the kit pill with plus glyph — `Pasteboard.multiDrop.test.tsx`
- [x] 4. e2e labels + drag visuals — `e2e/look-parity-page-labels.spec.ts`

## Manual test scenarios

1. Drag a filmstrip photo over the pasteboard: gap pill appears, hovered frame shows the chip, other empty frames get a dashed hint.
2. Page labels read 1, 2–3, 4–5 under the spreads and follow zoom / pan; Presentation shows none.
