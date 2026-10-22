## Proposal

Prod QA bug IMP-11/FS-03 (no roadmap item). Filmstrip sliding window goes blank mid-import when strides change after scroll without a further scroll event.

### Scope

- Re-sync virtual window start from current `scrollLeft` when the stride prefix changes (gallery append / aspect refine during import).
- Unit regression: mid-scroll + aspect refine without wheel → mounted window still covers the scrollport.
- Playwright: after bulk import while scrolled, window covers the port without a nudge.

### Done when

- Scrolling during ~200-photo import no longer leaves a large blank strip that only a small wheel nudge fills.
- No page-level H/V scroll; scrolling only inside `filmstrip-scroll`.

### Scope out

- Virtualizer rewrite / third-party list library
- Import pacing / LoAF budget changes
- Roadmap edits

### Delta / Risk

- E2e: happy mid-scroll cover after import settle without scroll; empty gallery unchanged. Scrollport: `filmstrip-scroll` only.
