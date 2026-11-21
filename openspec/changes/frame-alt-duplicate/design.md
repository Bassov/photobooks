## Decisions

1. A Select-tool Alt press (no Ctrl/⌘) on an own frame button of an interior spread, outside handles, starts a `duplicate` session. It is checked after the Ctrl/⌘+Shift override, before group / move. A selected frame duplicates the selection; else that frame.
2. Clone / paint / cursor helpers live in a new `src/editor/frameDuplicate.ts`. `frameGesture.ts` routes the session and shares the group-move delta math (union, clamp, Shift lock, snap; originals stay anchors, as in the kit).
3. Latch: `snapBypassed(event, altLatch)`. The press Alt does not bypass snapping; Alt pressed again after a move without Alt does.
4. Look: DOM clones of the frame buttons without chrome, with the existing select ring colour `--select` (docs/design.md selection) at .85. The originals' ring / handles / group box are hidden by a spread attribute. Checked with skill `ui-review`.
5. Release: `duplicateFramesBy` in `frameClipboard.ts`, shared with Ctrl+D, does one `duplicateFrames` op, sets `lastDuplicate` and selects the new frames. Under the slop / Esc: nothing dispatched.
6. Cursor: `data-alt-duplicate` on `.editor-workspace` while Alt is down; the CSS is gated on `[data-tool='select']`.

## Touch-set & Test Plan

| Path                                        |
| ------------------------------------------- |
| `src/editor/frameDuplicate.ts`              |
| `src/editor/frameGesture.ts`                |
| `src/editor/frameClipboard.ts`              |
| `src/render/SpreadView.css`                 |
| `src/editor/frameGesture.duplicate.test.ts` |
| `e2e/frame-copy-paste.spec.ts`              |

- Reuse: `snapRect`, `framesPayload`, `nextFrameIds`, `selectNew`, `swallowRelease`.
- Unit: slop click, one op + selection + `lastDuplicate`, multi, Shift, Esc, latch, dragstart, cursor attribute, bare-paper Alt = marquee.
- e2e: clone paint + count + Undo, under-slop click, Esc, `cursor: copy`, Ctrl+D repeat.
