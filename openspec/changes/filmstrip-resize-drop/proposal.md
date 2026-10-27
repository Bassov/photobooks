## Proposal

Roadmap: `docs/roadmap/M3/filmstrip-resize-drop.md` (scope / Browser / Perf SoT). UI ref: `uikit#/feature/filmstrip-resize-drop`.

### Scope out

- Loose-file drops (kit v4: folders only) and multi-root libraries: a dropped folder reuses the single-folder import (replace confirm).
- Pasteboard/canvas drop zones.

### Delta / Risk

- UI observables for e2e: empty filmstrip (no crash, hover outline on drag), happy (slider/splitter changes thumbs, persists on reload; dropped folder imports), scroll (resize mid-gallery, no gaps, zero LoAF). No page-level scroll; scrolling only inside `filmstrip-scroll`.
- Deviation: roadmap says dropped files "append"; the single-root model means a dropped folder replaces the bound folder (confirm), per kit v4.
- Security: drop uses `getAsFileSystemHandle` read-only; only directory handles accepted, no write permission requested.
