## Decisions

1. `src/editor/photoPick.ts` is a module store like `cropMode.ts`. While on it holds a capture `keydown` (Esc ends first, stops propagation), a capture `pointerdown` (outside `[data-testid="dock"]` ends) and store subscriptions (frame gone / locked, active spread, Masters tab, status re-assert). `EditorShell` ends it when Preview opens.
2. Start: `exitCropMode()`, `setFrameSource(target)`, a rAF focuses the roving thumb. `pickPhoto(assetId)` ends the mode, then dispatches `replace` / `place` — one history step labelled by `opLabel`.
3. The thumb strip `section[data-testid="filmstrip"]` carries `data-picking`: `box-shadow: inset 0 0 0 2px var(--select)` (= kit `--shadow-pick`), `.filmstrip-item { cursor: copy }`; grid click / Enter route to `pickPhoto` instead of selection.
4. Tag: `SpreadControl.pickKind` → `.spread-frame-crop-tag` span `pick-tag` "Replacing" / "Placing".
5. Menu rows: photo frame, unlocked, gallery ≥1 → enabled; locked → disabled.

## Touch-set & Test Plan

| Path                                      | Why                                        |
| ----------------------------------------- | ------------------------------------------ |
| `src/editor/photoPick.ts`                 | store                                      |
| `src/editor/photoPick.test.ts`            | unit                                       |
| `src/editor/Filmstrip.tsx`                | `data-picking`, click / Enter              |
| `src/editor/Filmstrip.css`                | ring, cursor                               |
| `src/editor/ConnectedSpreadView.tsx`      | `pickKind` control                         |
| `src/render/SpreadView.tsx`               | tag                                        |
| `src/editor/FrameContextMenu.tsx`         | two rows                                   |
| `src/editor/FrameContextMenu.test.tsx`    | added cases                                |
| `src/editor/EditorShell.tsx`              | Preview ends the pick                      |
| `e2e/photo-pick.spec.ts`                  | browser check                              |
| `src/editor/editorChromeTokens.ts`        | hovered / focused thumb tone while picking |
| `e2e/arrange-lock.spec.ts`                | exact row list + photo row                 |
| `e2e/parent-overrides.spec.ts`            | exact row list + photo row                 |
| `src/editor/Filmstrip.photoPick.test.tsx` | grid click / Enter / arrows while picking  |
| `src/editor/ConnectedSpreadView.test.tsx` | pick tag                                   |
| `src/editor/EditorShell.test.tsx`         | Preview ends the pick                      |

- Tests: unit — start, pick = one step, each cancel rule, status kept. e2e — empty-frame Place, happy pick (+ ring pixel sample), Enter, Esc / outside cancel, inside-dock keep, locked disabled. `ui-review` before push.
