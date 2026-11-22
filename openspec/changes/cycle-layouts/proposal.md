## Proposal

Roadmap: `docs/roadmap/P5/cycle-layouts.md`. UI ref: kit CL2 #707 `uikit/src/sandbox/layout-cycle.tsx`.

### Scope out

- `uikit/` files; core `rebindFrames` (CL1 #651).
- Hover preview from the pill; status message (D8).

### Delta / Risk

- e2e observables: happy (pill placed, ⇧] / › change layout), empty (no pill when set < 2), interact (3 presses + Ctrl+Z
  = 1 step; wheel zoom keeps it locked). No page-level H/V scroll; the pasteboard is the only scrollport.
- The active slot's paint clip widens so the pill above the paper paints.
