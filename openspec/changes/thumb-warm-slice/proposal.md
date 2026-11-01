## Proposal

Roadmap: `docs/roadmap/P1/thumb-warm-slice.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- `thumbCache.ts` and bulk hydrate (#375); `PERF_BUDGETS`, the LoAF gate, scheduler policy; per-step scan cost.

### Delta / Risk

- No spec delta: warm order, cap and retry rules stay the same. A LoAF attributed to our code is a defect; any rare LoAF not attributed to our code is evidenced in the PR body.
