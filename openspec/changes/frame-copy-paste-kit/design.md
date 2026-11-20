## Decisions

1. `clipboard.ts` is pure data on the kit `Doc` (spread mm): `framesPayload`, `pastedRects`, `pasteFrames`, `duplicateFrames`, `duplicateSpread`, module memory (mirror + `lastDuplicate`). The keys and listeners stay in `useEditorKeys`; the store is not touched.
2. D4 on the kit model: spread 0 is page 1 alone (right half); frames already sit in spread coords, so the slot map is a ±PAGE shift when the group's centre lies in a half with no page. Area = pages ± `Doc.print.bleed` (default 3 mm). Each D3 candidate (offset + k·5 mm, k ≤ 20) is clamped, then tested for "taken" (±0.01 mm).
3. Copy / cut / paste run on `document` clipboard events (D1). A target inside a field, the spread list, the filmstrip, a dialog or the open Site preview keeps the native behaviour; cover / endpaper / master / last page and Masters mode do nothing.
4. Ctrl+Shift+V: keydown sets `inPlace`; Chromium's paste-and-match-style event carries only `text/plain`, so with no text on it the in-memory mirror pastes.
5. Edits are one `st.update` each, from a doc computed outside the reducer (fresh `uid()`s must equal the new selection). Status timeouts read the live studio through a ref and clear only their own text.
6. The kit had no spread-row Ctrl+D; it is added with the row menu's Duplicate copy (chrome.tsx is off limits, so `duplicateSpread` mirrors it).
7. `__demo.reset()` lives in `features/demo.tsx` (off limits); it remounts the demo, so `DemoEditor` calls `resetClipboard()` on mount.

## Touch-set & Test Plan

| File                                      | Why                                             |
| ----------------------------------------- | ----------------------------------------------- |
| `uikit/src/sandbox/clipboard.ts`          | new: payload, rects, paste / duplicate, memory  |
| `uikit/src/sandbox/viewport.tsx`          | keys + document listeners                       |
| `uikit/src/demo-parts/editor.tsx`         | `resetClipboard()` on mount                     |
| `uikit/scripts/demo-capture.mjs`          | 5 steps, undo before `editor-photo-layer-hover` |
| `e2e/kit-frame-copy-paste.spec.ts`        | new e2e                                         |
| `docs/roadmap/P5/frame-copy-paste-kit.md` | item scope from the brief                       |

- Reuse: `removeFrames`, `FRAME_LOCKED_STATUS`, `fillTokens` / `anchorPhoto`, `pagesName`, `uid`.
- Tests: e2e only (uikit has no unit runner): offsets ±0.5 px, stepping, in place, Ctrl+Shift+V, step repeat, cut / lock, undo, spread-row Ctrl+D, Caption native copy / paste.
