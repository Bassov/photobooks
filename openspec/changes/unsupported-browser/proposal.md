## Proposal

Roadmap: `docs/roadmap/P2/unsupported-browser.md` (scope / Done when / Browser / Perf SoT). UI ref: Designer spec 2026-11-03; kit `#/demo` `__demo.unsupported`.

### Scope out

- No new variants, no “continue anyway”.
- No restyling of other screens' links.

### Delta / Risk

- Mobile UA (`iPhone|iPad|iPod|Android`, `Macintosh` + touch) blocks even with a picker; desktop Playwright is unaffected.
- e2e: happy (computed styles), interact (Copy link), 390×844 mobile; no page-level scroll, scroll only in `unsupported-scroll`.
