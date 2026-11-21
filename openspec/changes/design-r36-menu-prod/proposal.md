## Proposal

Roadmap: `docs/roadmap/P5/design-r36-menu-prod.md` (scope / Done when / Browser SoT). UI ref: `uikit#/feature/frame-context-menu`.

### Scope out

- Kit (`uikit/**`), filmstrip files (other lanes); menu text, focus and hover colours.

### Delta / Risk

- Dropping the `.pb-icon` colour rule mutes every prod menu's row icons (frame, spread, parent); destructive rows keep their ink; other icons keep inheriting.
- e2e observables: happy = frame menu open, muted row icon, dark Delete icon; interact = Duplicate glyph ≠ Copy; empty N/A.
