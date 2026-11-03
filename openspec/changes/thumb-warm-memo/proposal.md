## Proposal

Roadmap: `docs/roadmap/P2/thumb-warm-memo.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Pass cadence and window-order indexing per pass (#384 pacing unchanged).
- Import-time merge branch of `getAssetCacheKey` keeps the digest memo only.

### Delta / Risk

- No spec delta: only cost drops.
- Risk: the pending index drifting from the queue; every enqueue / abort / cancel / settle / reset site updates it, each unit-tested.
