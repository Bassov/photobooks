## Proposal

Roadmap: `docs/roadmap/P2/locked-frame-swap.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Context menu, Inspector, `frameArrange` (other lanes); unplace of a locked frame stays allowed.

### Delta / Risk

- Core guards every caller (`swapFrames`, `fillSpread`); swap / unplace keep the frame's own fields.
