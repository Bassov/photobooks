## Proposal

Roadmap: `docs/roadmap/P4/personal-site-kit-demo.md` (scope / Done when / Browser). UI ref: `uikit#/feature/personal-site`.

### Scope out

- Prod (`src/**`); K3 (site-viewer / site-photographer retirement, settings Site rows).
- Prod cover ink / cloth rules: the kit has a fixed cloth.

### Delta / Risk

- Kit `site-viewer`, `site-lightbox`, `site-preview-mode` now render the bookcase / room; their qa smokes and the two kit Preview e2e specs move with them. e2e: empty (nothing published → the open book), happy (titles), interact (Copied, lightbox, ← / →).
- No page-level scroll; the home scrolls only inside the site's case page.
