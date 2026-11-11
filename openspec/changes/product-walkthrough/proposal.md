## Proposal

Roadmap: `docs/roadmap/P4/product-walkthrough.md` (scope / Done when / Browser; SoT).

### Scope out

- Prod (`src/**`): none. DEMO branch, never merged (Owner 2026-11-12).
- No live tour; chapters link to `#/demo` and feature pages.

### Delta / Risk

- Observables (`guide-qa.mjs`): happy = all chapters render, images load, index links resolve; interact = TOC click scrolls to its chapter, Pages switch shifts nothing below. No empty state (static content).
- Scroll: the page scrolls vertically; no page-level horizontal scroll; the TOC scrolls only inside itself.
