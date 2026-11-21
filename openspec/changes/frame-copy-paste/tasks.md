## Implementation

- [x] 1. Core `parseFramesPayload` (+ `frameSchema` export), tests first. — `src/core/ops/clipboard.test.ts` "parses its own JSON back and refuses anything else".
- [x] 2. `frameReveal.ts` + `frameClipboard.ts` (commands, mirror, D8, guards, listeners) with unit tests; install in `EditorShell`. — `src/editor/frameClipboard.test.ts` (19), `src/editor/frameReveal.test.ts` (6).
- [x] 3. Pill statuses (`editorStatus.ts`) and undo labels (`bookHistory.ts`) with tests. — `editorStatus.test.ts`, `bookHistory.test.ts` "names cut, paste and duplicate steps".
- [x] 4. e2e `e2e/frame-copy-paste.spec.ts` per Spec Tests (no Alt-drag). — 6/6 pass locally.

## Manual test scenarios

1. Select a frame on Pages 2–3, Ctrl+C → "Copied frame"; Ctrl+V → a copy 5 mm down-right, selected; Ctrl+Z removes it.
2. Ctrl+D twice after moving the copy → the third lands at the same step.
3. Type in the Caption field, Ctrl+C / Ctrl+V → text copied, no frame pasted.

`pnpm agent manual-qa --change frame-copy-paste`: 1–3 problem (harness): the `start-session` click is intercepted by the welcome header, so the editor never opened; no product defect seen. Covered by e2e instead: 1 → `e2e/frame-copy-paste.spec.ts` "Ctrl+C says Copied frame…", 2 → "Ctrl+D duplicates +5 mm…", 3 → "the Caption field keeps native copy / paste" (all pass locally). ui-review: no findings (no new chrome; the existing status pill paints the clipboard statuses, `data-pill` asserted in e2e).
