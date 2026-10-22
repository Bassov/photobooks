## Proposal

Prod QA bug PLC-04 (no roadmap item). After swap → move → drop-on-self → unplace to filmstrip, one photo can appear twice and another is lost when an earlier filmstrip drag left a stale drop session / assetId mapping.

### Scope out

- New placement op types or undo/history
- Changing swap/place/replace pure-op contracts in `src/core`
- Filmstrip virtualization / import UX beyond clearing stale drag state

### Delta / Risk

- Drop session must not reuse a prior asset snapshot after a later frame drag; drop uses live frame filled state. Empty: unplace still clears one frame. Happy: swap/move/self/unplace keeps unique placements. Interact: no page-level H/V scroll; only `pasteboard-scroll` / `filmstrip-scroll`.
