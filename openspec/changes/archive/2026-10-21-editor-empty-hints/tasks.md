## Implementation

- [x] 1. Spec delta `editor-shell` “Empty editor and first placement guidance” + `bookHasAnyPlacement` / snapshot selector
- [x] 2. Extract shared chrome import (handlers + file inputs) from `EditorTopBar`; wire pasteboard EmptyState actions
- [x] 3. Pasteboard empty card (EmptyState + icon + Add folder… / Add photos…) when gallery empty; zero-import secondary line
- [x] 4. Placement hint overlay + one-shot polite Status announce; pointer-events none except card buttons
- [x] 5. Unit + e2e (#43 empty card, hint after import, hint gone after drag-place); roadmap scope ticks
- [x] 6. Manual QA + ui-review

## Manual test scenarios

1. OK Fresh session: “Start with your photos” card with Add folder… and Add photos…; Add photos opens file input; no page-level H/V scroll.
2. OK After importing photos: placement hint visible; first drag-place (or click-click) removes it; reload book with placements shows no hint.
3. OK Folder / batch that adds zero photos: card stays with “No photos found in that folder”; actions still work.

### ui-review

- Design system / a11y / layout smoke: pass — EmptyState + Button + Icon on tokens; keyboard-reachable card actions; polite Status announce once; empty geometry + viewport e2e green. Anti-slop N/A (editor chrome).
