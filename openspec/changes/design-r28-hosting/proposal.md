## Proposal

Roadmap: `docs/roadmap/P3/design-r28-hosting.md`. UI ref: `uikit#/feature/site-settings` (hosting scenarios).

### Scope out

- Kit (`uikit/**`), `src/ui/Button.css`, other Settings sections.
- No spec delta: visual parity only.

### Delta / Risk

- e2e locks: manual-mode help y (happy), CORS Copy ink, step Change ink (Continue → step 2); empty = setup step 1 card y unchanged.
- `XS_GHOST` loses its ink, so each caller must name one.
