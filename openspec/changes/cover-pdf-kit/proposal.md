## Proposal

Roadmap: `docs/roadmap/P4/cover-pdf-kit.md` (scope / Done when / Browser SoT). UI ref: `uikit#/feature/pdf-export`.

### Scope out

- Core cover painter, worker, preflight rules (`src/core/**`).
- Prod Print dialog and CoverView spine (item `cover-pdf`).

### Delta / Risk

- The kit run gains a cover unit: frozen texts move to `Page 12 of 20 · 50%`; scenario `Hidden, 48 %` → `Hidden, 50 %` (no qa.mjs / pages.json reference).
- Security: Open pages / Open cover reuse the `openSamplePdf` blob stand-in; no FS, worker or CSP change.
