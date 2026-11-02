## Proposal

Roadmap: `docs/roadmap/P1/import-relink-stall.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Making uncloneable picker doubles persist (prod walk artefact).
- Restore-time missing-entry import wave (no persist hook).

### Delta / Risk

- Failed IDB folder write no longer aborts import after batch 1; folder stays bound for the session; status says re-add after reload. UI: status line only, no new surface.
- Security: the FSA handle is still stored only via the existing root store; a failed write exposes no handle and widens no access.
