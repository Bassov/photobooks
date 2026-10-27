## Implementation

- [x] 1. `moveSpread` reapplies page roles; unit + PBT tests (`ops.test.ts`, `bookModel.ts` resync)
- [x] 2. `spreadReorder.ts` pure drop-target / shift / line / Alt+Arrow fns + tests
- [x] 3. `SpreadsPanel` drag reorder (transform shift, insertion line) + Alt+↑/↓
- [x] 4. Tests: panel drag/keyboard, retemplate keeps photos / overflow unplaced (`ops.test.ts`)
- [x] 5. e2e `e2e/spread-reorder.spec.ts` (drag + undo + pasteboard order, Alt+↓, retemplate keeps photos)

## Manual test scenarios

1. Drag spread 3 above 1: list and pasteboard follow; Undo restores.
2. Move the first spread to the middle: it re-lays as two-page, photos kept.
3. Focus spread 2, Alt+↑: moves to 1, focus follows.
4. Switch a filled spread's template: photos stay in order; fewer frames → extras unplaced in filmstrip.
