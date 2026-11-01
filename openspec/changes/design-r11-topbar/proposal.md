## Proposal

Roadmap: `docs/roadmap/P1/design-r11-topbar.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/demo`.

### Scope out

- Kit Print / Publish buttons and the kit's extra view toggles (guides, rulers, overlays, DPI).
- Shared `Button` / `IconButton` variants and base styles (design-r11-controls).

### Delta / Risk

- Top-bar-local styling only; `skip_specs: true` (editor-shell contract unchanged).
- e2e locks: toggles on (happy) and off (photos panel hidden), hover on each control, and x / size / colour of every top-bar item; no page-level scroll change.
