## Proposal

Roadmap: `docs/roadmap/M3/filmstrip-resize-drop.md` (scope / Browser / Perf SoT). UI ref: `uikit#/feature/filmstrip-resize-drop`.

### Scope out

- Loose-file drops (kit v4: folders only) and multi-root libraries: a dropped folder reuses the single-folder import (replace confirm).
- Pasteboard/canvas drop zones.

### Delta / Risk

- UI observables for e2e: empty filmstrip (drop hint, no crash), happy (slider/splitter changes thumbs, persists on reload; dropped folder imports), scroll (resize mid-gallery, no gaps, zero LoAF). No page-level scroll; scrolling only inside `filmstrip-scroll`.
- Security: drop uses `getAsFileSystemHandle` read-only; only directory handles accepted, no write permission requested.
