## Proposal

Roadmap: `docs/roadmap/P2/live-captions.md` (SoT). UI ref: Designer spec `live-captions` item 3; kit `uikit#/demo` step `editor-text-live`.

### Scope out

- Core tokens / ops / head-pass meta (#488) and the kit (#491): reused, unchanged.
- Photo inspector Caption stays as is.

### Delta / Risk

- e2e locks empty (Live off: switch + chips, no select; no image frame → disabled switch + hint), happy (chip → canvas date, swap updates, Make static holds) and interact (chip at the caret, Anchored to); no page-level H/V scroll.
