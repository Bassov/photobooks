## Proposal

Roadmap: `docs/roadmap/P3/gl-faces-probe-flaky.md` (scope / Done when / Perf SoT).

### Scope out

- No change to `e2e/gl-faces-probe.spec.ts` or `PERF_BUDGETS`.
- No change to the page painter (`src/render/`) and no worker move of face painting.

### Delta / Risk

- A face takes about 12 short tasks instead of 2, so near faces land slightly later.
- Success: `e2e/gl-faces-probe.spec.ts` passes under 3× CPU throttle with no long task.
