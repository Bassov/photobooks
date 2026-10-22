## Decisions

1. Root cause after #182: filmstrip tiles are react-aria `GridListItem` rows. Their Space keydown stops before the window bubble listener, so `spaceRef` never arms after a tile click even though toolbar buttons still work.
2. Fix: track pointer-over-pasteboard on the scrollport (enter/leave + last-point `elementFromPoint` recovery); listen for Space in **capture** on `window`. When pointer is over the pasteboard and focus is not a text field, `preventDefault` + `stopPropagation` + arm pan so filmstrip rows do not toggle. When pointer is not over the pasteboard, do not arm or steal Space so keyboard tile/radio activation still works.
3. Drop the radio-only early-return; hover gates it. Spec: Space-pan after filmstrip focus requires pointer over pasteboard.

## Touch-set & Test Plan

| File                                     | Why                                                |
| ---------------------------------------- | -------------------------------------------------- |
| `src/editor/usePasteboardCamera.ts`      | hover + capture Space arming                       |
| `src/editor/cameraGesture.test.tsx`      | unit: filmstrip-row focus + hover; radio off-hover |
| `e2e/spread-view.spec.ts` (or filmstrip) | PB-04: click tile → hover pasteboard → Space+drag  |
| `openspec/specs/spread-view/spec.md`     | pointer-over + filmstrip-focus contract            |

- Reuse: `isTextField`, pasteboard scrollport, existing Space+drag e2e helpers
- Tests: unit — synthetic stopPropagation Space target mimicking row + pointerenter; e2e — import photo, click `filmstrip-item`, move to pasteboard, Space+drag scroll changes
