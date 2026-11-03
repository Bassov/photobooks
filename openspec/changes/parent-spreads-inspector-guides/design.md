## Decisions

1. `GuidesOverlay` `guidesOf` and `startGuideDrag` resolve ids through `editableSpread` (parent = two pages). Core guide ops already reach the parent via `updateSpread`.
2. The master stage mounts the existing `Rulers` on Shift+R: `.cover-stage[data-rulers]` insets its inner `.masters-area` 22 px top/left (kit `r = RULER`). `Rulers` takes an optional `pxPerMm`, since the master is off the pasteboard camera.
3. A placed guide finds its ruler via `closest('[data-rulers]')`, so drop-on-ruler removes on both stages.
4. Tokens: `--guide` (`.guide-line`), `--chrome` (ruler strips); none new.

## Touch-set & Test Plan

| File                                                                       | Why                                                        |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `src/editor/GuidesOverlay.tsx`                                             | `guidesOf` via `editableSpread`; ruler via `[data-rulers]` |
| `src/editor/guideGesture.ts`                                               | spread + index via `editableSpread`                        |
| `src/editor/Rulers.tsx`                                                    | optional `pxPerMm`                                         |
| `src/editor/MastersCanvas.tsx`                                             | rulers + inset area on the master stage                    |
| `src/editor/useClientSize.ts`                                              | also returns the attached element (rulers' area)           |
| `src/editor/useClientSize.test.tsx`                                        | the ref                                                    |
| `src/editor/CoverCanvas.css`                                               | `.masters-area` inset while rulers show                    |
| `src/editor/GuidesOverlay.test.tsx`                                        | parent-id overlay                                          |
| `src/editor/guideGesture.test.ts`                                          | parent-id add / move + undo / remove                       |
| `src/editor/MastersCanvas.test.tsx`                                        | rulers on the master stage                                 |
| `e2e/parent-spreads-guides.spec.ts`                                        | browser check, reload, perf gate                           |
| `openspec/changes/parent-spreads-inspector-guides/specs/book-core/spec.md` | master guides contract (delta)                             |

- Unit: overlay, gesture and MastersCanvas paths on a parent id (above).
- e2e: `?fixture=painter&parent=a` ruler add / move + undo / ruler remove, zero-LoAF drag gate; `?testLibrary=1` save + reload.
