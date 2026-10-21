## Decisions

1. **Reuse EmptyState + extract import actions:** Pasteboard mounts centered `EmptyState` (“Start with your photos”) with primary “Add folder…” / secondary “Add photos…” when `gallery.length === 0`. Extract shared chrome import (pickers + hidden inputs + `runChromeImport`) from `EditorTopBar` so both chrome and the card share handlers.
2. **Narrow placement boolean:** Pure `bookHasAnyPlacement(book)` + `getHasAnyPlacementSnapshot` via `subscribeBookStore`. Hint when gallery non-empty and boolean false; announce once via polite `setEditorStatus` when it appears.
3. **Overlay + zero-import line:** Card/hint overlay pasteboard; hint `pointer-events: none`; only card buttons capture clicks. After import that leaves gallery empty, secondary description “No photos found in that folder” (clear on gallery growth). Does not implement `folder-skip-non-images`.
4. **Perf / security:** Card mounts only while gallery empty; hint one boolean. Gates: `drag-place-replace` + bulk-import — zero LoAF. Reuse existing FSA pickers; no new handle surface.

## Touch-set & Test Plan

- Files: `src/editor/{Pasteboard,EditorTopBar,EditorShell}.tsx|css`, `chromeImport*` / `bookHasAnyPlacement` / pasteboard-empty extracts, `editorStatus`, `docs/design.md`, roadmap item, `openspec/specs/editor-shell/spec.md` (+ change specs), unit + `e2e/editor-empty-hints.spec.ts`.
- Reuse: `src/ui/{EmptyState,Button,Icon,Status}`, `runChromeImport`, `bookStore`.
- Tests: unit (empty→card; photos+no place→hint; place→gone; placements→no hint; zero-import line); e2e (#43 card + Add photos → input; hint after import; gone after drag-place). Manual + ui-review.
