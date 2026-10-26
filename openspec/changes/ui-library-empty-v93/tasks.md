## Implementation

- [x] 1. Add page-size presets helper (kit PRESETS cm→trim mm) + extend `createBookInLibrary` / `createEmptyLibraryBook` to accept trim
- [x] 2. Port BookObject / LibraryEmpty / LibraryBar chrome (+ TS styles, c18b credit/photo); wire empty `LibraryScreen` branch
- [x] 3. Port CreateBookDialog (Dialog + title/presets/orientation/custom); open from empty Create book and with-books New book; drop library `promptBookTitle` create path
- [x] 4. Keep Change library FSA + Settings stub; retire empty-home `pb-screen` EmptyState placeholder
- [x] 5. Update LibraryScreen / create / credits unit tests
- [x] 6. Update e2e library-screens for empty kit chrome + create dialog → editor
- [x] 7. Sync editor-shell spec + design.md empty-library status; tick roadmap scope

## Manual test scenarios

1. Empty library: example Fog book + plain credit under Example; Create book is primary black; no “0 books” / capsule.
   - OK: `e2e/library-screens.spec.ts` “empty library kit chrome and Create book dialog open editor” (example-book + screen-credit + no 0 books)
2. Create book dialog: pick A5 portrait titled “Trip” → editor opens with that title and trim ≈148×210 mm.
   - OK: same e2e create-title Trip → create-book → editor-shell; unit CreateBookDialog A5→148×210 mm
3. Dialog Cancel returns to empty library unchanged.
   - OK: same e2e Cancel → create-book-dialog gone, library-empty stays, no editor-shell
4. Change library still uses real directory picker (no fake FolderPicker).
   - OK: “change library updates folder name via FSA picker stub”
5. Empty and with-books: document has no page-level H/V scroll; list overflow only inside `library-scroll`.
   - OK: assertDocumentFitsViewport on empty/create flows; “library scrollport contains overflow when many books”

## UI review

- Design system: Theme B tokens + inventory Button/Dialog/SegmentedControl; Lora `--font-heading`; no parallel chrome — OK
- A11y: labeled title/preset/custom; Escape cancel; busy disabled; `:focus-visible` via Button; `prefers-reduced-motion` on `.pb-lib-rise` — OK
- Layout smoke (Playwright): empty example+credit; cancel stays; create→editor; `library-scroll` — OK
- Anti-slop: grayscale chrome, primary black Create, plain caption (no capsule) — OK
