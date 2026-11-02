## Proposal

Roadmap: `docs/roadmap/P2/photo-slot-stretch.md` (SoT).

### Scope out

- Photo tier pipeline (tiers are already upright).
- PDF / print export (no render path in `src/` yet).
- Spec delta (`spread-view` already requires source-crop framing).

### Delta / Risk

- Risk: none for perf; one compare per tier decode, a publish only on a placeholder mismatch.
