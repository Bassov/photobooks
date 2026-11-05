## Decisions

1. Del / Backspace live in `useEditorKeys` beside the arrows, under the same gate (`features.handles`, a selection, not cropping). `useKeys` already skips input / textarea / contenteditable, so the text editor keeps its keys. Focus in `[data-filmstrip]` is left to the filmstrip's own Del handler.
2. Del removes the selected unlocked frames in one undo step ("Delete frame" / "Delete N frames", template detached like `DeleteFrameButton`); the locked ones stay and stay selected. Nothing unlocked selected → no op and the locked status.
3. One exported `FRAME_LOCKED_STATUS` in `canvas.tsx`, used by the drag (`canvas.tsx` move start) and by the nudge / Del in `viewport.tsx`. A nudge whose selection is all locked skips `st.update` (no empty undo step) and sets the status.

## Touch-set & Test Plan

| Path                             | Why                                       |
| -------------------------------- | ----------------------------------------- |
| `uikit/src/sandbox/viewport.tsx` | Del / Backspace; all-locked nudge status  |
| `uikit/src/sandbox/canvas.tsx`   | shared `FRAME_LOCKED_STATUS` for the drag |
| `e2e/kit-frame-keys.spec.ts`     | kit `#/demo` frame-key regression         |

- Reuse: `mapSpread`, `useKeys`, the drag's status message.
- Tests: Playwright on `/uikit/#/demo` — Del 1 → −1, Backspace on 2 → −2; locked frame survives Del; Del / Backspace in the text editor edit text only; all-locked ArrowRight + Shift+ArrowRight → frame rects equal, status text with box > 0 and painted pixels. No unit / PBT (kit sandbox has no unit lane).
