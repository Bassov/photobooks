## Proposal

Roadmap: `docs/roadmap/P4/design-r24-site-prod.md` (scope / Done when / Browser). UI ref: kit `#/demo` personal-site.

### Scope out

- Kit (`uikit/**`) and editor Preview chrome (`src/editor/**`).
- Phone room head (no name there, as in the kit).

### Delta / Risk

- e2e locks: phone Page turn paints cover, page 1, page 2 (GL on / `gl=0`); 390 tap rests on Cover; desktop name link goes home in one step. Empty state N/A.
- Risk: the GL canvas shows at rest only after `draw` returned true.
