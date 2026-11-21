## Proposal

Roadmap: `docs/roadmap/P5/interface-size-popovers.md` (scope / Done when / Browser); design interface-size §4, IS5.

### Scope out

- Dialogs / Toast (interface-size-modals), `src/editor/*` and pointer maths (interface-size-pointer), `uikit/`.

### Delta / Risk

- `FrameContextMenu.tsx` puts the menu anchor at raw `clientX` inside the zoomed `#root` (× s): the e2e pins the
  menu against its anchor; the anchor fix belongs to interface-size-pointer (flagged in the PR).
