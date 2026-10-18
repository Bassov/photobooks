# e2e-frame-budget-flakes

Tag: prep
Milestone: M2.1
Title: Stabilize frame-budget (LoAF) e2e flakes without looser budgets

## Scope

- [x] `drag-place` frame-budget scenarios (zoomed-out gallery drag, save during drag) and `spread-view › continuous zoom stays within frame-budget gates`
- [x] Root-cause each LoAF (trace in the Playwright report): fix pacing in app code (rAF scheduling, worker offload) or make the measurement window deterministic; budgets in `src/perf/budgets.ts` do not change
- [x] Remove the per-spec `retries: 2` from the fixed describe blocks
- **Done when:** the three scenarios pass CI `burn-in` (`--retries=0`) with unchanged budgets, and the fixed cases are under nested describes with `retries: 0` (not `retries: 2`). Continuous zoom gates LoAF on zoom-in, tier switches, and zoom-out burst+paint; zoom-out settle remount stays asserted under the parent `retries: 2` describe until `continuous-zoom-settle-mount-pace` moves it to `retries: 0`.
- **Size:** ~600 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** PR #80 S2

## Done note

Wheel coalesce (pure `mergePendingWheel`); per-spread thumb/tier keys; nested retries:0 for fixed cases; continuous zoom LoAF phased; settle remount still gated under parent retries until follow-up; CI burn-in is the flake proof (local repeats ≤3 only when needed).
