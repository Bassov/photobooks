## Proposal

Roadmap: `docs/roadmap/P5/text-blocks-close.md` (scope / Done when); closes `docs/roadmap/P2/text-blocks.md`.

### Scope out

- Product code in `src/` or `uikit/`; spec deltas (behavior already specified by text-frames-core / text-frames-editor).
- The paint-probe lane files and the parent-overrides / parent-spreads specs.

### Delta / Risk

- Tests only: three `text-blocks` lines had no direct lock-in (font gate before measure, typing render isolation, thumbnail parity); a new test that fails on main is a product gap → item stays open.
