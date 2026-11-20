## Decisions

1. `clipboard.ts` is pure data on the kit `Doc` (payload, `pastedRects`, paste, duplicate, spread duplicate, mirror + `lastDuplicate`); keys and listeners stay in `useEditorKeys`, the store is untouched. Each edit is one `st.update` of a doc built outside the reducer, so the new `uid()`s equal the new selection.
2. D4 on the kit model: spread 0 is page 1 alone (right half); a group centred in a half with no page shifts by one page; area = pages ± `Doc.print.bleed`. Each D3 candidate is clamped, then tested for "taken".
3. Document copy / cut / paste events (D1); fields, spread list, filmstrip, dialogs and the Site preview keep native keys. Chromium's Ctrl+Shift+V event carries only `text/plain`; with no text on it the in-memory mirror pastes in place.
4. The kit had no spread-row Ctrl+D; it is added with the row menu's copy (`chrome.tsx` is off limits).
5. `__demo.reset()` remounts the demo, so `DemoEditor` resets the clipboard on mount.

## Touch-set & Test Plan

| File                                      | Why                                               |
| ----------------------------------------- | ------------------------------------------------- |
| `uikit/src/sandbox/clipboard.ts`          | new: payload, rects, paste / duplicate, memory    |
| `uikit/src/sandbox/viewport.tsx`          | keys + document listeners                         |
| `uikit/src/demo-parts/editor.tsx`         | `resetClipboard()` on mount                       |
| `uikit/scripts/demo-capture.mjs`          | 5 steps, undone before `editor-photo-layer-hover` |
| `e2e/kit-frame-copy-paste.spec.ts`        | new e2e                                           |
| `docs/roadmap/P5/frame-copy-paste-kit.md` | item scope from the brief                         |

- Tests: e2e (uikit has no unit runner) for offsets ±0.5 px, stepping, in place, step repeat, cut / lock, undo, spread-row Ctrl+D, Caption native copy / paste.
