## Proposal

Roadmap: `docs/roadmap/P1/thumb-background-warm.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/feature/editor-shell-filmstrip` (no visual change).

### Scope out

- Working preview 1280 stays on demand; no HEIC decoder, `PERF_BUDGETS`, dependency or tile-look change.

### Delta / Risk

- The off-now JPEG/HEIC lazy ban is lifted only for the warm lane; import still defers them while it runs (warm starts at import end).
