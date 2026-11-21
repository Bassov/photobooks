## Proposal

Roadmap: `docs/roadmap/P5/cycle-layouts-kit.md` (scope SoT, incl. picker frame props and Stack band centring).
Designer Spec: `shared/design/cycle-layouts/spec.md` (CL2). UI ref: kit `#/demo`.

### Scope out

- Prod `src/` (CL3) and core `rebindFrames` (CL1, #651).
- `uikit/scripts/qa.mjs` (frozen); no spec delta.

### Delta / Risk

- Observables: happy = pill over the paper; empty = hidden (gap < 63, Preview, Masters, one-layout set); interact =
  ›, ⇧] (`]` still toggles), one undo step per run.
- No page-level scroll; scrolling stays in the `pasteboard` stack scrollport.
