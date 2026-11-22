## Decisions

1. **Set = picker list**: `pickerLayouts` in `layoutCatalog.ts` feeds picker and cycle; `cycleSet` keeps items with n
   slots (n = non-text frames, as `rebindFrames`), `stepLayout` wraps; not in set = Custom.
2. **Apply** = picker op via `dispatchBookOp(op, 'cycleLayout:<id>', 'Change layout')`; same-key adjacency coalesces.
3. **Pill** in the active slot, `data-camera-frame`, `bottom: calc(100% + 8px / cam-scale)`; active slot
   `overflow-clip-margin` grows so it paints.
4. **Visibility** per the spec requirement: stores in React, asset drag / marquee / Preview in CSS; live zoom via a
   per-element `data-gap-min` read by `writeCameraFrame`.
5. **Pointer**: pill stops React `pointerdown`; `marqueeSpread` ignores `.layout-cycle` (capture listener).
6. **Keys** `installLayoutCycleKeys`; chrome keys skip Shift so brackets never toggle panels under Shift.
7. Tokens per `docs/design.md` (`--chrome`, `--field`, `--accent`, `--radius-md`, `--card-edge`); skill `ui-review`.

## Touch-set & Test Plan

| Path                                         |
| -------------------------------------------- |
| `src/editor/layoutCatalog.ts`                |
| `src/editor/LayoutSection.tsx`               |
| `src/editor/applyMarkedSpreadTemplate.ts`    |
| `src/editor/installEditorChromeKeys.test.ts` |
| `src/editor/layoutCycle.ts`                  |
| `src/editor/LayoutCycle.tsx`                 |
| `src/editor/LayoutCycle.css`                 |
| `src/editor/installLayoutCycleKeys.ts`       |
| `src/editor/installEditorChromeKeys.ts`      |
| `src/editor/Pasteboard.tsx`                  |
| `src/editor/pageLabelsModel.ts`              |
| `src/editor/usePasteboardCamera.ts`          |
| `src/editor/marquee.ts`                      |
| `src/editor/EditorFrame.tsx`                 |
| `src/editor/EditorShell.css`                 |
| `src/editor/layoutCycle.test.ts`             |
| `src/editor/LayoutCycle.test.tsx`            |
| `src/editor/installLayoutCycleKeys.test.ts`  |
| `e2e/cycle-layouts.spec.ts`                  |

- Reuse: `Tooltip`, `Icon`, `isTypingTarget`, `dispatchBookOp`.
- Tests: PBT (n × › then n × ‹ returns; picker order; wrap; Custom); component hide rules; e2e per roadmap Browser check
  plus no marquee from a press on the pill.
