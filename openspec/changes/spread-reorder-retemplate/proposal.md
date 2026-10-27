## Proposal

Roadmap: `docs/roadmap/M3/spread-reorder-retemplate.md`.

### Scope out

- Multi-spread drag, drag between books, master pages.
- New template picker (existing `SpreadTemplateBar` stays).

### Delta / Risk

- Left list gains drag + Alt+↑/↓ reorder; `moveSpread` re-lays spreads whose page count changed. Empty: one spread, no drag. Happy: drag 3 above 1; list + pasteboard follow; one undo. Scroll only inside `spreads-list`; no page-level H/V scroll.
- Security: N/A (drag payload is a local spread id).
