## Proposal

Roadmap: `docs/roadmap/P3/design-r25-publish-cache.md` (scope / Done when SoT).

### Scope out

- `viewer/fonts/*`: copied from `public/` without a hash, so they stay `no-cache`.
- Static export (`src/site/**`) writes no cache headers; off limits for this lane.

### Delta / Risk

- No spec delta: P6 already requires immutable for content-hashed keys.
- Risk: a lowercase-only 8-char hash (≈0.1 %) stays `no-cache`, which only costs a revalidation.
