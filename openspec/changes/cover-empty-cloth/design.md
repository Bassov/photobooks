## Decisions

1. `coverInk(cloth)` in `coverTitleFace.ts` reuses `relativeLuminance` (siteModel, D38 0.23) → `#F5F5F5` / `#2E2C2D`. A photo front keeps white + shadow.
2. CoverView: the photo-less `.cover-front` paints `backFill` inline and sets `--cover-title-ink` / `--cover-title-shadow` on itself; the sheet paints `backFill` flat.
3. Edit-mode empty front renders `.cover-front-drop` "Drop a photo for the front" (Spec numbers in CoverView.css), hidden at rest, shown on `.cover-front:hover` or the sheet's `data-drop-target`.
4. Library: summary `coverBackFill` / `coverTitleFont` → grid `backFill` / `titleFont` → BookTile → BookObject `fill` + `<em>` face.
5. Book shadows: `var(--book-shadow, var(--shadow-book))`; card hover sets `--book-shadow: var(--shadow-book-hover)` (no drop-shadow filter). Kit library mirrors it.
6. Kit v7: empty front + sheet = cloth `#3E3C3B`, `#F5F5F5` title, hover drop box.

## Touch-set & Test Plan

| File                                | Why                     |
| ----------------------------------- | ----------------------- |
| `src/render/coverTitleFace.ts`      | `coverInk`              |
| `src/render/CoverView.tsx`          | cloth front, drop box   |
| `src/render/CoverView.css`          | drop box                |
| `src/render/BookObject.tsx`         | fill, face              |
| `src/render/bookObjectLayout.ts`    | token shadows           |
| `src/project/bookSummary.ts`        | summary fields          |
| `src/project/types.ts`              | summary type            |
| `src/editor/libraryBookFilter.ts`   | grid fields             |
| `src/editor/BookTile.tsx`           | pass cloth / face / ink |
| `src/editor/libraryScreenStyles.ts` | hover shadow            |
| `uikit/src/sandbox/v7.tsx`          | kit front               |
| `uikit/src/features/library.tsx`    | kit shadows             |
| `e2e/cover-empty-cloth.spec.ts`     | paint + drop box        |
| `e2e/design-r10-library.spec.ts`    | card title face         |
| `e2e/kit10-cover.spec.ts`           | front = cloth           |
| `e2e/kit-pdf-export.spec.ts`        | kit sheet = cloth       |

- Reuse: `relativeLuminance`, `COVER_TITLE_FACES`, `pixelsAt`, `openLibraryBook`.
- Unit: coverInk threshold; CoverView front fill / drop box; BookObject; summary and grid fields; layout shadow strings. e2e per tasks 6.
