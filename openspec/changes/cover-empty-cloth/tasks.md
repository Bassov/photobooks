## Implementation

- [x] 1. `coverInk` (D38) next to the cover title faces, unit-tested at the 0.23 threshold (`src/render/coverTitleFace.test.ts`).
- [x] 2. CoverView: empty front and sheet paint backFill, front ink by `coverInk`, edit-mode drop box on hover / drag-over (`src/render/CoverView.test.tsx`, `e2e/cover-empty-cloth.spec.ts`).
- [x] 3. Library summary → grid book → BookTile → BookObject carry backFill and Title font; empty card paints the cloth (`bookSummary.test.ts`, `libraryBookFilter.test.ts`, `BookTile.test.tsx`).
- [x] 4. Library card shadows on `--shadow-book` / `--shadow-book-hover` (prod + kit library; `bookObjectLayout.test.ts`, e2e card shadow).
- [x] 5. Kit v7 empty front = cloth, `#F5F5F5` title, hover drop box (`e2e/kit-pdf-export.spec.ts` sheet = cloth).
- [x] 6. e2e `cover-empty-cloth.spec.ts`: paint checks (card, Cover row, editor front), title face / ink, drop box at rest vs hover / drag-over, card shadow token.

## Manual test scenarios

1. New book with no cover photo: library card, spread-list Cover row and editor front read as the back cloth with a Lora italic title in light ink.
2. Hover the editor front: the drop box with "Drop a photo for the front" appears; leaving hides it.
3. Hover a library card: the shadow deepens (shadow-book-hover).

manual-qa (2026-11-21): problem (harness) on 1–3: `start-session` click intercepted by the welcome header, no scenario
reached the editor. Covered by `e2e/cover-empty-cloth.spec.ts` (both tests pass locally: card / Cover row / front
centre pixels = cloth ±2, Lora Cover italic #F5F5F5 title, drop box hidden at rest, shown on hover and drag-over with
the Spec numbers, card box-shadow = --shadow-book then --shadow-book-hover on hover).
