## Decisions

1. `SettingsScreen` takes `bookCount: number | null`; `null` renders "—" in the same muted `tabular-nums` span, exactly as Preview cache does for `cacheBytes === null` (`SettingsScreen.tsx`). No new token or primitive (`docs/design.md` muted-foreground ink).
2. `EditorSettings` starts at `null` and sets the count only on `listed.ok`; failure stays `null`.
3. `LibraryScreen` keeps `listedFor: string | null`, the library id whose listing produced `books` (`null` before the first listing or after a failure, set in the effect and in `refreshBooks`). Settings gets `books.length` only when `listedFor` equals the current `project.libraryId`, so a changed library shows "—" until its own listing lands. The grid keeps its `booksListed` gate unchanged.

## Touch-set & Test Plan

| Path                                  | Why                                   |
| ------------------------------------- | ------------------------------------- |
| `src/editor/SettingsScreen.tsx`       | nullable count → "—"                  |
| `src/editor/EditorSettings.tsx`       | start at `null`, failure stays `null` |
| `src/editor/LibraryScreen.tsx`        | `listedFor` gate for Settings count   |
| `src/editor/SettingsScreen.test.tsx`  | `null` → "—", `0` → "0"               |
| `src/editor/EditorSettings.test.tsx`  | pending / resolve / real 0 / failure  |
| `src/editor/LibraryScreen.test.tsx`   | pending, failure, library change      |
| `e2e/settings-books-count.spec.ts`    | editor → Settings DOM probe           |
| `openspec/specs/editor-shell/spec.md` | Live book count scenario (via delta)  |

- Reuse: `attachMemoryLibraryForTests` + `createBookInLibrary` (e2e, as `design-create-library-chrome.spec.ts`), `attachMemoryLibraryForTests` after mount (library change in unit).
- e2e: a MutationObserver plus 16 ms `setInterval` samples of `settings-book-count` for 500 ms after the gear press; assert no "0" sample and the last sample is "1". Fails on main (first commit renders "0").
