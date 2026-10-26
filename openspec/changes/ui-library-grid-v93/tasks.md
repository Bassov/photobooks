## Implementation

- [x] 1. Enrich `BookSummary` (+ FSA/memory list) with optional spread/trim; delta `library-storage` spec
- [x] 2. Add session `deleteBookInLibrary` / `duplicateBookInLibrary` with unit tests
- [x] 3. Port `BookTile` / `LibSearch` / `LibSort` + library grid styles/icons/`MenuSeparator`
- [x] 4. Wire `LibraryScreen` non-empty branch (grid, menus, search/sort, change confirm); keep empty/create
- [x] 5. Update unit + e2e library specs (Open, rename, search, sort, confirm Change, scrollport)
- [x] 6. Tick roadmap scope; update `docs/design.md` Library grid migration row

## Manual test scenarios

1. Library with ≥1 book: kit book objects; Open → editor; Rename / Duplicate / Remove persist
2. Search filters by title; Sort cycles Last edited / Title / Created
3. Change library shows kit confirm, then FSA; no page-level scroll on grid
