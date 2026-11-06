## Decisions

1. **Undoable state in the doc.** Sandbox `Doc` gets `print?: { profile; bleed; safe }`; a pick is one `st.update(…, "Printer")` step (D4: bleed clamped into the profile range, safe = profile safe; size and spreads untouched). Absent = Generic, bleed 3, safe `book.safe` (today). Folios read `printSafe(doc, book)` so S and the folio inset agree.
2. **Profiles and strings in `demo-parts/printProfiles.tsx`:** CATALOG + `PrintCustomsCtx` (default `SAMPLE_CUSTOMS`; `DemoEditor` provides the session customs and its PrintDialog reads the doc's profile); pure `profileHint`, `printIssues`, `pagesRange`. Unknown id → Generic + "isn't in this library" warning.
3. **Layout:** classes per designer spec §Book settings → PRINT; polite sr-only live region "Printer: {name}". Tokens `--warning-fg`, `--field` (docs/design.md).

## Touch-set & Test Plan

| Path                                     | Why                                               |
| ---------------------------------------- | ------------------------------------------------- |
| `uikit/src/sandbox/v7.tsx`               | PRINT select, hint, warnings, B/S, Pages range    |
| `uikit/src/sandbox/model.ts`             | `Doc.print`                                       |
| `uikit/src/sandbox/canvas.tsx`           | folios use the print safe                         |
| `uikit/src/sandbox/chrome.tsx`           | folios use the print safe                         |
| `uikit/src/demo-parts/printProfiles.tsx` | helpers + customs context                         |
| `uikit/src/demo-parts/editor.tsx`        | provide customs; PrintDialog profile from the doc |
| `uikit/src/features/pages.tsx`           | `inspector` scenario `book-lulu`                  |
| `uikit/scripts/qa.mjs`                   | kit qa asserts                                    |

- Reuse: `profileById`, `fmtN`, `Field`, `Sec`, `e7-sel`.
- Tests: kit qa (DOM, 1440 × 900) asserts positions and colours per the spec, pick + one undo, Pages range 20–120. No `src/` → no unit / e2e.
