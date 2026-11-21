## Decisions

1. `src/editor/frameClipboard.ts` is a plain (non-React) module like `installEditorKeys`: each command dispatches one `BookOp` with `ids` from core `nextFrameIds`, selects them, sets the active spread and exits crop mode. Mirror and D8 `lastDuplicate` are module state.
2. `installFrameClipboard()` (document `copy` / `cut` / `paste` + Ctrl/⌘+V / D `keydown`) is installed in `EditorShell`. Guards follow kit `OWN_KEYS` plus text edit, Masters tab, cover / endpaper; a guarded event is not prevented.
3. Core `parseFramesPayload` (Zod on the book `frameSchema`) is the only way a pasted string becomes a payload.
4. Statuses reuse the existing status pill (`editor-status-pill`, no new tokens): the copied and D7 texts join `isStatusPillVisible`; timeouts clear only their own text. Skill `ui-review` applies.
5. Reveal: pure `revealDelta` in `src/editor/frameReveal.ts`, applied to `.pasteboard-scroll` in the next frame; no zoom change.

## Touch-set & Test Plan

| File                                  | Why                                      |
| ------------------------------------- | ---------------------------------------- |
| `src/editor/frameClipboard.ts`        | commands, mirror, step memory, listeners |
| `src/editor/frameClipboard.test.ts`   | unit                                     |
| `src/editor/frameReveal.ts`           | reveal math + scroll                     |
| `src/editor/frameReveal.test.ts`      | unit                                     |
| `src/editor/EditorShell.tsx`          | install                                  |
| `src/editor/editorStatus.ts`          | pill statuses                            |
| `src/editor/editorStatus.test.ts`     | pill statuses                            |
| `src/editor/bookHistory.ts`           | labels                                   |
| `src/editor/bookHistory.test.ts`      | labels                                   |
| `src/core/ops/clipboard.ts`           | `parseFramesPayload`                     |
| `src/core/ops/clipboard.test.ts`      | parse                                    |
| `src/core/schema.ts`                  | export `frameSchema`                     |
| `src/core/index.ts`                   | export                                   |
| `e2e/frame-copy-paste.spec.ts`        | Keys-table rows                          |
| `openspec/specs/editor-shell/spec.md` | requirement sentence                     |
| `docs/roadmap/P5/frame-copy-paste.md` | item scope                               |

- Tests: unit per module; e2e per Spec Tests (no Alt-drag). Must-stay-green specs unchanged.
