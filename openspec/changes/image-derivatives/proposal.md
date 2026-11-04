## Proposal

Roadmap: `docs/roadmap/P3/image-derivatives.md` (scope / Done when / Perf SoT).

### Scope out

- No editor caller yet: P3 viewer / publish items wire it.
- Thumb / tier pipeline unchanged (read-only queue signals).

### Delta / Risk

- New capability `src/derivatives/` + spec `image-derivatives`, reusing `DerivedCache`.
- Risk: encode vs drag. Own 1-worker pool, starts only when decode, metadata and scroll-quiet are idle; perf gate.
- Security: worker gets asset bytes + known preset ids only, transfers buffers back; no blob URLs, network or dependency; test seam DEV / fixtures only.
