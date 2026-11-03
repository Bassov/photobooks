## Proposal

Roadmap: `docs/roadmap/P2/multi-select-inspector.md` (SoT).

### Scope out

- Multi inspector on the Masters canvas; kit `chrome.tsx`, `v7.tsx`, book / endpaper files; parent re-align ops.

### Delta / Risk

- #415 added no multi shell (2+ selected shows the Spread view). e2e: empty (2 frames, Distribute disabled), happy (3 frames distribute, Undo, Delete 3), interact (menu, shortcuts).
- No page-level H/V scroll or layout shift; only the inspector body scrolls.
