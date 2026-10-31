## Proposal

Roadmap: `docs/roadmap/P1/decode-no-source-copy.md` (scope / Done when / Perf SoT).

### Scope out

- Faster decode (`ImageDecoder`, scaled decode): `thumb-scaled-decode`.
- Decode slot abort / in-flight reuse: `decode-slot-busy-until-reply`.

### Delta / Risk

- "Memory-backed root" = registered memory source, or no source yet (`memorySourceForRoot` registers one, as today for library file picks). A registered non-memory (FSA) source skips seed.
- Security: worker `postMessage` now transfers `sourceBuffer`; same origin worker, no new surface.
