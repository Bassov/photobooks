## Proposal

Roadmap: `docs/roadmap/P4/cover-editor-core.md` (scope / Done when / Browser / Perf SoT); Designer Spec `cover-editor` items D1, D2, D7, "Geometry".

### Scope out

- Cover canvas layers, spine text, inspector hint (`cover-editor`, prod) and the kit (`cover-editor-kit`).
- Any UI for the manual spine width (D7).

### Delta / Risk

- The generic spine rule becomes 8 + 0.2 mm/page, so drawn spines are unchanged; a cover with `spineWidthSource: 'manual'` now draws `style.spineWidthMm` (no UI writes it yet).
