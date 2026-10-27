## Proposal

Roadmap: `docs/roadmap/M3/presentation-mode.md` (UI ref: `uikit#/feature/presentation-mode`).

### Scope out

- Higher image tiers for fullscreen.
- `site-lightbox` itself (only the shared pager).
- Browser Fullscreen API.

### Delta / Risk

- Shared pager + Present overlay. E2E locks: Present disabled with no spreads; arrows/click change `n / N`; Esc restores editor; last-spread next is a no-op. No page-level scroll.
- Security: N/A.
