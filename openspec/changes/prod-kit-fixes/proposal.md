## Proposal

Roadmap: [`docs/roadmap/P2/prod-kit-fixes.md`](../../../docs/roadmap/P2/prod-kit-fixes.md) (P1–P3 scope / Done when).

### Scope out

- `uikit/` and other lanes' files; live commit in inspector `NumberField`s (each commit is an undo step, no derived hint).

### Delta / Risk

- `formatNumber` drops trailing zeros in every `NumberField` (kit `maximumFractionDigits: 1`).
- e2e observables: editor Settings opens even with an empty library (back bar text / ink / x), filmstrip chips pills at rest and on hover, custom size hint while typing.
