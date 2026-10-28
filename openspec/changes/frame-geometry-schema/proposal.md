## Proposal

Roadmap: `docs/roadmap/M4/frame-geometry-schema.md` (scope / Musts / Test SoT).

### Scope out

- No canvas UI, handles, or transform ops (`frame-selection-handles`, `frame-transform-ops`).
- No painter rendering of rotation; resolver only exposes it.

### Delta / Risk

- Schema v3 → v4: optional `rotationDeg`, `locked`, crop `quarterTurns` / `straightenDeg`; migration sets `rotationDeg: 0`.
- Security: none (pure document/resolve logic).
