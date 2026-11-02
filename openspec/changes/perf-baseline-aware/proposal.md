## Proposal

Roadmap: [`docs/roadmap/P2/perf-baseline-aware.md`](../../../docs/roadmap/P2/perf-baseline-aware.md) (scope / Done when).

### Scope out

- Thresholds, PERF_BUDGETS, the 3-run rule, the nightly, required `perf`.
- `src/`, `quality/gates.json`, functional e2e lane.

### Delta / Risk

- Masking: a new regression inside an already-red scenario passes unless the PR touches its spec, sources or shared perf code.
- Security: job gains `actions: read`; the main-run artifact is parsed as data only, any parse error means no baseline.
