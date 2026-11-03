## Implementation

- [x] 1. `SettingsScreen` nullable `bookCount` renders "—" (`SettingsScreen.test.tsx` "shows a muted dash for an unknown book count and 0 for an empty library")
- [x] 2. `EditorSettings` pending / failure → "—", resolve → count, real 0 → "0" (`EditorSettings.test.tsx` "shows a dash while the list is pending…", "shows 0 for a library with no books", "keeps the dash when listing fails")
- [x] 3. `LibraryScreen` Settings count gated on the listing for the current library (`LibraryScreen.test.tsx` "Settings count is a dash until the current library is listed", "…after a failed listing, the count after retry")
- [x] 4. e2e DOM probe editor → Settings never sees "0" (`e2e/settings-books-count.spec.ts`; fails with the old `useState(0)`: samples `["0"]`)

## Manual test scenarios

1. Library with one book → open the book → gear: the Books row reads "—" or "1", never "0"; Back returns to the book.
2. Library → Settings: Books row shows the library's count.
