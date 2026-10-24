## Decisions

1. **Surfaces** replace `home`: `unsupported` | `welcome` | `library` | `editor`. Gate unsupported first (no `showDirectoryPicker`, insecure context, or `userAgentData.mobile`). Nothing behind the gate. Tests keep FSA stubs only.
2. **Single library**: One opaque handle (id `library`) + folder label + active book id + per-book lock. Drop recents/remove-recent. Migrate: adopt `__recents` front handle; delete other handles and `__recents`; keep `__active` book id when present.
3. **Permission**: Restore uses `queryPermission` (readwrite). `granted` → library; `prompt` → Allow access → `requestPermission` before picker; denied/missing → welcome Choose folder (`id: 'photobooks-library'`, details in editor-shell delta). Change library: same picker; `isSameEntry` dedupe.
4. **Library UI** (`Button`, `EmptyState`, `Dialog`, `Status`; tokens from `docs/design.md`): empty → Create book; list → open, New book, Change library (folder name as path), Settings stub. Editor back → library.

## Touch-set & Test Plan

- Files: `src/project/session/{types,idb,browserSessionState,memorySessionState,libraryLabel,sessionState.contract.test-helpers}.ts` (+ tests; drop `recents.ts`); `src/editor/{LibraryScreen,WelcomeScreen,UnsupportedBrowserScreen,browserSupport,screenPlaceholders,projectSession,EditorTopBar}.tsx?` + `session/{libraryActivation,browserProjectSessionPlatform}.ts`; `src/App.tsx`; `e2e/{library-screens,permissions-locks,open-save,book-titles}.spec.ts` (+ fixtures; drop `recents-home`); openspec deltas `session-state` / `editor-shell`.
- Reuse: FSA helpers, UI primitives above, memory session seam, `attachMemoryLibraryForTests`.
- Tests: session contract + migrate; screen/gate unit; e2e unsupported, welcome empty, library empty+list (create/open/change/settings), editor→library; library scrollport only (no page H/V); skill `ui-review` before push.
