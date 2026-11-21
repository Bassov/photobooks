## Decisions

1. Replace "spread reveal, then frame nudge when settled" (two scrolls per axis) with one frame-targeted reveal: `requestSpreadReveal(spreadId, frameId?)` carries the frame through `Pasteboard` → `beginRevealForNewSpread` → `turnPendingReveal`. Mounting an unmounted spread (force-mount + tracked scroll, no real scroll) is reused; the only real scroll is one `nudgeBoxIntoInsetPort` on the frame. Callers without `frameId` are unchanged.
2. The frame branch retries until the frame has a box, nudges once and reports `insetPortSettled` (clamp-aware), also used after paint. A frame already in place gets delta 0 (re-click: no scroll). `placedJump`'s rAF settle loop is removed.
3. Rejected: nudge at once when the frame is mounted, two-step otherwise — the Designer's 2× fresh jump targets an unmounted spread (overscan is one stride), so y would still double-scroll.

## Touch-set & Test Plan

| Path                                            |
| ----------------------------------------------- |
| `src/editor/placedJump.ts`                      |
| `src/editor/placedJump.test.ts`                 |
| `src/editor/pasteboardReveal.ts`                |
| `src/editor/pasteboardReveal.test.ts`           |
| `src/editor/usePasteboardReveal.ts`             |
| `src/editor/usePasteboardReveal.test.tsx`       |
| `src/editor/photoRootSession.ts`                |
| `src/editor/Pasteboard.tsx`                     |
| `src/editor/spreadsPanelModel.test.ts`          |
| `e2e/placed-badge.spec.ts`                      |
| `docs/roadmap/P5/design-r43-badge-jump-prod.md` |

- Unit: frame reveal (least scroll, centring, 0 px, missing frame, clamps, post-paint retry); hook forwards `frameId`; jump requests `(spreadId, frameId)`.
- e2e: rAF scroll trace at 200 % (fresh, re-click 0 px, cycle to Page 4) and 1060 wide; M145 under-the-list test re-parks the frame under the list, one sideways move.
