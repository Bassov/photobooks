## Implementation

- [ ] 1. Core `parseFramesPayload` (+ `frameSchema` export), tests first.
- [ ] 2. `frameReveal.ts` + `frameClipboard.ts` (commands, mirror, D8, guards, listeners) with unit tests; install in `EditorShell`.
- [ ] 3. Pill statuses (`editorStatus.ts`) and undo labels (`bookHistory.ts`) with tests.
- [ ] 4. e2e `e2e/frame-copy-paste.spec.ts` per Spec Tests (no Alt-drag).

## Manual test scenarios

1. Select a frame on Pages 2–3, Ctrl+C → "Copied frame"; Ctrl+V → a copy 5 mm down-right, selected; Ctrl+Z removes it.
2. Ctrl+D twice after moving the copy → the third lands at the same step.
3. Type in the Caption field, Ctrl+C / Ctrl+V → text copied, no frame pasted.
