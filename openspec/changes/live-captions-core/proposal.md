## Proposal

Roadmap: `docs/roadmap/P2/live-captions-core.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Inspector Live block, chips, canvas editing (`live-captions`).
- Kit `meta.ts` (`live-captions-kit`); old-book migration.

### Delta / Risk

- Anchors live on a book spread's own frames only (invariant scope); parents and local copies are never anchored.
- Normalise skips unchanged spreads by identity (hot drag ops stay O(spreads)).
