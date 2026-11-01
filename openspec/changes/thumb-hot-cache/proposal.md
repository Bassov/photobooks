## Proposal

Roadmap: `docs/roadmap/P1/thumb-hot-cache.md` (SoT). UI ref: `uikit#/feature/editor-shell-filmstrip`.

### Scope out

- Decode pipeline, folder scan, pill / gap / drop code, tile look.
- DerivedCache format and eviction.

### Delta / Risk

- e2e: empty strip unchanged; 400 cached thumbs; fling shows 0 placeholders in `filmstrip-scroll`. No page-level H/V scroll; scrolling only inside `filmstrip-scroll`.
- Security: same-origin `blob:` URLs, revoked on eviction/removal/replace/reset; ~128 MB bound.
