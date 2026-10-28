## Proposal

Roadmap: `docs/roadmap/M4/frame-transform-ops.md` (scope / Musts / Test SoT).

### Scope out

- No canvas UI, handles, pointer wiring, snap, multi-select, toolbar.
- No schema bump; `setFrameRect` (used by draw/move today) is unchanged.

### Delta / Risk

- New pure ops in `src/core/ops/transform.ts` via `BookOp`; locked frames are skipped (same book returned).
- Security surface: N/A (pure math).
