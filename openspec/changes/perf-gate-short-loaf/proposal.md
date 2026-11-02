## Proposal

Roadmap: `docs/roadmap/P1/perf-gate-short-loaf.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- `PERF_BUDGETS` values, `src/perf/loafObserver.ts` and every non-fling LoAF scenario.
- No attribution filter: the ≤ 5 ms rule ignores the script source.

### Delta / Risk

- Gate change, Owner-approved (2026-11-02). Risk: masking a real regression; mitigated because > 20 ms and ≥ 2 entries > 5 ms still fail, and unit tests plus the canary lock all three cases.
