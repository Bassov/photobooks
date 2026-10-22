## Proposal

Roadmap: N/A (prod manual-QA bug; no roadmap item).

### Scope out

- Tier ladder sizes, LRU capacity, or worker encode path
- Filmstrip thumb generation / import hydrate
- New UI chrome or tokens

### Delta / Risk

- Fast pasteboard scroll: filled frames MUST show cached thumb/lower tier immediately (not blank) while covering tier loads; empty frames stay placeholders; unit locks non-blank `src` after remount.
- Scrollport stays pasteboard-only (no page H/V scroll).
