# kit-undo-fixes

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item kit-undo-fixes

## Scope

Kit bug (Designer notes on #491 parity): two undo bugs in the uikit sandbox editor (`#/demo` editor steps), so the kit matches prod. Kit only, no prod files.

- [ ] `uikit/src/sandbox/store.tsx`: history entries carry the current spread before and after a spread-structure op; undo selects the one before, redo the one after
- [ ] `uikit/src/sandbox/chrome.tsx` / `viewport.tsx`: every `st.update` + `st.setCur` spread op (Duplicate, Add after, Delete, Reorder, New spread from drop) passes its new current spread to the store
- [ ] Undo / redo keys (Ctrl/⌘+Z, Shift+Ctrl/⌘+Z, Ctrl/⌘+Y) work whenever focus is not in a text input, textarea or contenteditable (a focused Switch, checkbox, radio or slider no longer swallows them)
- [ ] One kit e2e spec covering both bugs, with a paint check of the spread list
- **Done when:** Duplicate spread 3 → Ctrl+Z → spread 3 selected, count back to N; Shift+Ctrl+Z → copy (4) selected, N+1. Focus a Switch in the inspector → Ctrl+Z undoes the last op (doc state asserted). Ctrl+Z inside a text input does not undo the doc. Screenshot pixels of the spread list after undo show the original spread highlighted.
- **Browser check:** kit `#/demo` editor: duplicate a spread, Ctrl+Z / Shift+Ctrl+Z; focus the Live caption Switch, Ctrl+Z.
- **Hard nos:** no prod `src/` changes; no edits to `uikit/scripts/qa.mjs`, `uikit/src/kit/pages.json`, `uikit/src/features/pages.tsx`, `uikit/src/demo-parts/**`, `uikit/src/features/site-viewer*`, `docs/design.md`; kit switch size is out of scope
- **UI kit:** `uikit#/demo` editor steps; parts `uikit/src/sandbox/store.tsx`, `chrome.tsx`, `viewport.tsx`
