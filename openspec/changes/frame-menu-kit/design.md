## Decisions

1. One `FrameMenu` per `Viewport` (camera and stack); a hidden marker finds its root, so other viewports' frames are ignored. The anchor is portalled to `body`; `MenuPopover` places `bottom start` at the pointer.
2. Target order follows prod `handleOwner` / PO4: keyboard path → the selection; a selected frame under the pointer (geometric) → it; else the own frame hit; else the page menu, only when `clipboardMirror()` holds frames and no parent frame is hit.
3. Rows are data (`frameGroups`), disabled via `disabledKeys`; edit / photo groups only on the Pages canvas (D10).
4. Reuse `clipboard.ts`, `removeFrames` / `deleteLabel`, `resetParentItem`, `setCropId`; `zMove` / `zMovesFor` move to `store.tsx` unchanged. Menu Copy / Cut also fill the system clipboard (one-shot `copy` listener) so Ctrl+V pastes them.
5. `menuKeys`: today's strings; mac ⇧⌘ / ⌫ glyphs.
6. Look: kit `Menu*` primitives per `docs/design.md`; key column `[font-family:inherit]` (prod `.pb-menu-keyboard`). No new tokens.

## Touch-set & Test Plan

| Path                                | Why                                       |
| ----------------------------------- | ----------------------------------------- |
| `uikit/src/sandbox/frame-menu.tsx`  | new menu                                  |
| `uikit/src/sandbox/store.tsx`       | `zMove`, `zMovesFor`, `pick`, `startPick` |
| `uikit/src/sandbox/inspector.tsx`   | ArrangeSection uses `zMove`               |
| `uikit/src/sandbox/viewport.tsx`    | mount `FrameMenu`; Esc ends pick first    |
| `e2e/kit-frame-menu.spec.ts`        | new e2e                                   |
| `docs/roadmap/P5/frame-menu-kit.md` | item                                      |

- Tests: e2e per menu kind, focus, size / paint, y 840; existing kit specs unchanged.
