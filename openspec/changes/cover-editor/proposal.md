## Proposal

Roadmap: `docs/roadmap/P4/cover-editor.md` (scope / Done when SoT); Designer spec `cover-editor` item 3; UI ref `uikit#/feature/cover-editor`.

### Scope out

- `uikit/`, `src/site/**`; no manual spine control (D7).

### Delta / Risk

- Fit now fits the sheet: cover text px at Fit shrink by 787.73/848, so e2e assert ratios to the cover.
- No page-level H/V scroll; the cover stage never scrolls.
