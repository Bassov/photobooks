## Decisions

1. `placePhoto(st, si, frameId, photo)` in `store.tsx` = the single-photo drop body; `handleDrop` and the pick both call it, so a pick is exactly a drop (one undo step).
2. `startPick` also selects the frame, makes its spread current and sets the Spec status; `endPick` clears pick + status; `pickPhoto` = `placePhoto` + end.
3. Filmstrip while picking: ThumbGrid `selectionMode="none"` + `onAction` (click and Enter), `data-picking` ring `inset 0 0 0 2px var(--select)`, thumbs `cursor: copy`, hover / focus-visible → `bg-sel`. Existing kit tokens only (docs/design.md); no `src/` tokens.
4. Tag `pick-tag` on the target frame with the crop-tag classes.
5. `usePickGuard` (viewport.tsx): capture-phase Esc ends the pick first; outside-dock pointerdown, spread / mode / preview change, frame removed or locked end it.
6. Menu rows also need ≥ 1 gallery photo.

## Touch-set & Test Plan

| Path                                | Why                  |
| ----------------------------------- | -------------------- |
| `uikit/src/sandbox/store.tsx`       | pick + place helpers |
| `uikit/src/sandbox/canvas.tsx`      | drop reuse, tag      |
| `uikit/src/sandbox/chrome.tsx`      | filmstrip pick       |
| `uikit/src/sandbox/frame-menu.tsx`  | row enable           |
| `uikit/src/sandbox/viewport.tsx`    | guard                |
| `uikit/scripts/demo-capture.mjs`    | demo steps           |
| `e2e/kit-photo-pick.spec.ts`        | kit e2e              |
| `docs/roadmap/P5/photo-pick-kit.md` | item                 |

- e2e: the roadmap Done when list, with Spec values and a painted-ring pixel check.
