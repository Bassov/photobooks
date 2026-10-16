# Design

## Context

See proposal.md. Ready adapters: `createFsaLibraryStorage` / memory (`src/project`), `createBrowserSessionState` (`src/project/session`), `createFsaAssetSource` / memory (`src/assets`). Editor today: in-memory `bookStore` + session `File` map; no open/save chrome. FSA **load** already uses a book-load worker; save still serializes on the caller today.

## Goals / Non-Goals

**Goals:** Wire one active library + one active book; create/open/save chrome; Ctrl/Cmd+S; restore document when library handle granted; library-backed import writes identity + registers roots; save off the gesture path; e2e empty/happy/restore + save-during-drag perf.

**Non-Goals:** Autosave, re-grant/lock UX, home/recents, multi-book picker, persisting photo-folder handles, domain API redesign.

## Decisions

1. **Project session module** — `src/editor/projectSession.ts`: active `LibraryStorage`, `SessionState`, library id, book id, in-session `AssetSource` map. Methods: `createLibrary` / `openLibrary`, `createBook`, `saveBook`, `tryRestore`. Inject memory adapters in tests. Do not grow `bookStore` into a god store.

2. **Picker** — `showDirectoryPicker({ mode: 'readwrite' })` for library root; hidden `data-testid` seam injects storage/handle for e2e. Perf scenarios keep disabling real pickers.

3. **Save path** — Snapshot `Book` from `bookStore`; schedule `storage.saveBook` via `scheduler.postTask` (or idle) — never from `dragover` / pointer handlers. Use today’s FSA `serializeBook` on that scheduled turn; add a serialize worker only if the save-during-drag LoAF gate fails (inline contingency, not a new roadmap item). Status via polite live region / narrow store field.

4. **Restore (document vs media)** — On boot: recall library handle; if granted, rebuild FSA storage, `loadBook(activeBookId)`, replace `bookStore`. Persist `libraryId` + `activeBookId` in `sessionStorage` (**Assumption:** promote into SessionState in `recents-home` if needed). **Media:** photo-folder `AssetSource` / session `File` maps are **not** persisted (deferred to `missing-assets-relink`). After reload, gallery + placements come from `book.json`; thumbnails/tiers rehydrate from `DerivedCache` when `contentHash` was saved; otherwise placeholders until relink. Browser check “same book” = same gallery ids, placements, layout (previews via DerivedCache when hashed). E2e happy path injects adapters that keep source bytes available so decode also works in CI.

5. **Import + roots** — Library-backed import registers an in-session `AssetSource` via `createMemoryAssetSource` + `seedFile` (FSA directory-handle AssetSource deferred with photo-folder handle persistence to `missing-assets-relink`); write `sourceRootId` / `relativePath` / size / mtime; enqueue existing lowest-priority hash worker for `contentHash`. No library: session File map only.

6. **Chrome** — Create library, Open library, Create book (library open), Save (library-backed). Typed-failure status. No new scrollports.

## Touch-set

`src/editor/projectSession.ts` (+tests), `EditorShell.tsx` / thin library chrome, `bookStore.ts`, `importPhotos.ts`, `pickLibrary.ts` (or extend pick helpers), `e2e/open-save*.ts`, perf scenario + list, AGENTS/roadmap as needed. Avoid `src/project` contract edits unless unavoidable.

## Composition

Adapters in `src/project` / `src/assets`. Editor owns orchestration + chrome. Core stays pure.

## Tests

- Unit: projectSession + memory adapters; library-backed import identity fields.
- E2E: empty chrome; save → reload → restore document; injected failure status; `assertDocumentFitsViewport` + `assertNamedScrollport` (filmstrip / pasteboard).
- Perf: save during drag — zero LoAF.
- `ui-review` before push.

## Security

FSA readwrite library root; handles only in SessionState / FSA adapters — never in `book.json` or worker payloads on the domain LibraryStorage API. Security Review + `pnpm audit:ci` before archive.

## Risks / Trade-offs

- [No photo-folder handle persistence] → Document + DerivedCache after reload; full original access needs `missing-assets-relink`.
- [Hash async] → Early save may lack `contentHash`; path/size/mtime still persist; cache hydrate waits for hash.
- [Main-thread serialize] → Background schedule first; worker only if gate fails.

## Migration Plan

Additive. Rollback = revert PR. Without a library, session-only editor behavior remains.
