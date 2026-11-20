## Implementation

- [ ] 1. `coverInk` (D38) next to the cover title faces, unit-tested at the 0.23 threshold.
- [ ] 2. CoverView: empty front and sheet paint backFill, front ink by `coverInk`, edit-mode drop box on hover / drag-over.
- [ ] 3. Library summary → grid book → BookTile → BookObject carry backFill and Title font; empty card paints the cloth.
- [ ] 4. Library card shadows on `--shadow-book` / `--shadow-book-hover` (prod + kit library).
- [ ] 5. Kit v7 empty front = cloth, `#F5F5F5` title, hover drop box.
- [ ] 6. e2e `cover-empty-cloth.spec.ts`: paint checks (card, Cover row, editor front), title face / ink, drop box at rest vs hover, card shadow token.

## Manual test scenarios

1. New book with no cover photo: library card, spread-list Cover row and editor front read as the back cloth with a Lora italic title in light ink.
2. Hover the editor front: the drop box with "Drop a photo for the front" appears; leaving hides it.
3. Hover a library card: the shadow deepens (shadow-book-hover).
