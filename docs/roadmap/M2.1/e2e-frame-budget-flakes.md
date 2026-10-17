# e2e-frame-budget-flakes

Tag: prep
Milestone: M2.1
Title: Stabilize frame-budget (LoAF) e2e flakes without looser budgets

## Scope

- [ ] `drag-place` frame-budget scenarios (zoomed-out gallery drag, save during drag) and `spread-view › continuous zoom stays within frame-budget gates`
- [ ] Root-cause each LoAF (trace in the Playwright report): fix pacing in app code (rAF scheduling, worker offload) or make the measurement window deterministic; budgets in `src/perf/budgets.ts` do not change
- [ ] Remove the per-spec `retries: 2` from the fixed describe blocks
- **Done when:** the three scenarios pass `--repeat-each=20 --retries=0` locally and in CI `burn-in` with unchanged budgets, and their describe blocks have no `retries` override.
- **Size:** ~600 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** PR #80 S2
