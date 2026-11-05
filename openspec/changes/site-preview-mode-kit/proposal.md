## Proposal

Roadmap: `docs/roadmap/P3/site-preview-mode-kit.md`. UI ref: `uikit#/feature/site-preview-mode`; Designer spec `site-preview-mode` §6.

### Scope out

- Prod `src/**` (items 2/3); `uikit/src/**/canvas.tsx` (parent-overrides-kit lane).

### Delta / Risk

- Observables per spec §6, locked by kit qa (happy: open values; interact: steps, Esc order, Tab trap; empty: N/A, a book always has a cover). No page-level scroll at 1440 × 900 / 1280 × 720; only `site-preview-scroll` scrolls.
- Book-page arrow keys move to document capture so they run under the preview's key guard.
