## Decisions

1. Reuse Package F ports (`BookObject`, `LibraryBar`, `LibraryEmpty`, `CreateBookDialog`, `libraryScreenStyles`); add `BookTile`, `LibSearch`, `LibSort` + quiet CSS — never import `uikit/src/**`. Tokens: `--chrome` / `--accent` / `--foreground` / `--muted-foreground` / `--background`; primitives `Button`, `IconButton`, `Menu*`, `AlertDialog` (`docs/design.md`). Quiet field fill uses kit `#D7D7D7` on chrome (document in design.md if new).
2. Enrich `BookSummary` with optional `spreadCount` + page trim mm (list already parses) for format + “N pages”; no Published chip / fake covers.
3. Open / Rename via existing session APIs; thin `deleteBookInLibrary` / `duplicateBookInLibrary` (load→new id→`createBook`, stay on library).
4. Change library: kit `AlertDialog` then `changeLibraryFolder()` (FSA); Settings gear stub.
5. Search by title; sort title localeCompare; Last edited = list order; Created = reverse list (intentional proxy — no mtime in schema).
6. Add in-repo glyphs (`search`, `moreHorizontal`, `pencil`, `chevronDown`, `folderOpen`, `folderSync`) + `MenuSeparator`.

## Touch-set & Test Plan

- Files: `src/editor/LibraryScreen.tsx` (+ styles/tests), new `BookTile`/`LibSearch`/`LibSort`, `projectSession` delete/dup, `src/project` summary enrich + memory/FSA, `src/ui` icons/MenuSeparator, `docs/design.md` migration row, `e2e/library-screens.spec.ts` (+ book-titles as needed), OpenSpec delta `library-storage`.
- Reuse: F empty/create path, `AlertDialog`, `Menu*`, `displayBookTitle` / `promptBookTitle`.
- Tests: unit grid/search/sort/menu/confirm; session delete/dup; contract list enrichment; e2e empty = Package F empty/create lock-in; happy grid Open + search; scrollport `assertDocumentFitsViewport` / `assertNamedScrollport('library')`; skill `ui-review` before push.
