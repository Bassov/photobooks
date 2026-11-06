## Proposal

Roadmap: `docs/roadmap/P3/design-r20-kit-mod-arrows.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Prod (`src/`): already ignores modified arrows.
- The `#/demo` preview shell (`uikit/src/demo-parts/site.tsx`) keeps letting Alt+Arrow through on purpose (browser back / forward).

### Delta / Risk

- UI: one guard in the kit book-page keydown; e2e locks the happy path (plain → steps) and the interact path (modified keys keep the label). Empty state N/A (a new book always has slides).
