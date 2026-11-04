## Proposal

Roadmap: `docs/roadmap/P2/parent-overrides-canvas.md` (scope / Done when / Browser). Design SoT: Designer `parent-overrides` PO1–PO3.

### Scope out

- PO4 menus, PO5 guide override / hide, inspector, kit; a copy's handles stay inside its button (no handle proxy).

### Delta / Risk

- Empty: no parent → no layer, outline or badge. Interact: Ctrl+Shift through an own frame copies and moves the logo; Undo twice restores it. No page-level H/V scroll; scrolling only inside the pasteboard scrollport.
- `removeFrames` on a copy hides its parent item (book-core contract).
