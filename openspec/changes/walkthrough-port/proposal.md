## Proposal

Roadmap: `docs/roadmap/P5/walkthrough-port.md` (scope SoT). UI ref: `uikit#/guide`. Specs: none, kit-only (`skip_specs: true`).

### Scope out

- `src/**`, `pages.json` / `features/pages.tsx`, `qa.mjs`, `demo-capture.mjs`, old `guide-qa.mjs`.

### Delta / Risk

- Scroll: the guide scrolls as a page with no horizontal scroll; the sticky TOC (`guide-toc`) scrolls in its own list. No empty state (static copy).
- Risk: stale copy. Each chapter is checked against main and every figure is recaptured. No security surface (static images, a dev script).
