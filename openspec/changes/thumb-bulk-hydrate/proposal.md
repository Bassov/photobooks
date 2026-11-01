## Proposal

Roadmap: `docs/roadmap/P1/thumb-bulk-hydrate.md` (SoT). UI ref: `uikit#/feature/editor-shell-filmstrip` (no visual change).

### Scope out

- Thumb pack storage; miss decode stays on mount.
- Filmstrip components and DerivedCache files untouched.

### Delta / Risk

- UI: empty (no gallery, no run); happy (reload, tiles hot before scroll); scroll (fling end and back, 0 placeholders in `filmstrip-scroll`); no page-level H/V scroll.
- Security: no new FS access; URLs use the existing `storeThumb` revoke path.
