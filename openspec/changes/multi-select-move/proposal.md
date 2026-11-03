## Proposal

Roadmap: [`docs/roadmap/P2/multi-select-move.md`](../../../docs/roadmap/P2/multi-select-move.md). UI ref: Designer Spec `multi-select/spec.md` "Group move"; `uikit#/feature/frame-selection-handles`.

### Scope out

- Marquee and multi inspector (next items).

### Delta / Risk

- e2e: 3 selected (one locked) drag → one undo; Esc keeps 3 selected; arrows leave `pasteboard-scroll` scrollLeft unchanged; group box per frame. Empty: 0–1 selected → no group move. No page-level H/V scroll.
