## Decisions

1. **One edit path.** `editableSpread(book, id)` (core `parentSpreads.ts`) returns a spread, else the parent as a memoized spread view (`parentId: null`, index -1 = two pages). `updateSpread` falls back to it and writes items / guides / grid back, so every existing spread op (add frame, move, resize, nudge, place, Delete) edits a parent unchanged. Read lookups (`resolveSpread`, paint snapshot, frame gesture / handle / selection) switch to `editableSpread`.
2. **CRUD ops** `addParent` (`parent-<n>` unused by any spread / parent, "Master <letter>"), `renameParent` (trimmed, non-empty), `removeParent` (its spreads and a matching default → None). One history step each.
3. **Notify only users:** the parent id plus spreads whose resolved parent object changed.
4. **UI.** Masters list rows (`e7-item`, `SpreadThumb`, `Menu` Rename / Delete, inline rename like the library), ghost "New master" (kit `chrome.tsx:321`). Canvas: `ConnectedSpreadView` of the selected parent in a `cover-stage`; items are added with the top-bar Frame tool or a filmstrip drop (e2e draws a frame = the logo). Inspector in Masters mode: one hint line. Mode switch clears frame selection. Grayscale tokens only (`--canvas`, `--muted-foreground`).
5. **Size:** list CRUD + canvas edit need the core fallback (~14 files); the rest is split.

## Touch-set & Test Plan

- Files: `src/core/parentSpreads.ts`, `src/core/update.ts`, `src/core/index.ts`, `src/core/ops/applyBookOp.ts`, `src/core/geometry/resolveSpread.ts`, `src/editor/bookStore.ts`, `src/editor/frameGesture.ts`, `src/editor/frameHandleGesture.ts`, `src/editor/frameSelection.ts`, `src/editor/leftPanelTabStore.ts`, `src/editor/LeftPanel.tsx`, `src/editor/Inspector.tsx`, `src/editor/EditorShell.tsx`, new `src/editor/MastersPanel.tsx`, `src/editor/MastersCanvas.tsx` (replaces the stub), `e2e/parent-spreads-edit.spec.ts`, `e2e/kit10-masters.spec.ts`, `docs/roadmap/**`.
- Tests: unit + PBT (CRUD, delete → None, op on parent id); bookStore notify; list / canvas component tests; e2e with DOM rects; skill `ui-review`.
