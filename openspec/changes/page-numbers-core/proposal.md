## Proposal

Roadmap: [`docs/roadmap/P2/page-numbers-core.md`](../../../docs/roadmap/P2/page-numbers-core.md) (scope / Done when SoT).

### Scope out

- Any UI: canvas folios, Masters `#` chips, inspector and Book settings sections (item `page-numbers`).
- `src/render/`, `uikit/`, editor paint-cache keys.

### Delta / Risk

- Undo of `setPageNumbering` needs `pageNumbering` in the history snapshot (non-UI lines in `bookHistory.ts` / `bookStore.ts`).
- Folio x is clamped into the safe area, so margins below `safe` still print; numbers for margins ≥ safe are unchanged.
