# frame-budget-gates

Tag: prep
Milestone: M1
Title: 60 fps measurement and gates (Security Review: headers)

## Scope

- [x] `src/perf/`: rAF frame-pacing sampler, Event Timing (INP) observer, `performance.measure` helpers for hot handlers; exposed via `__photobooksPerf`
- [x] Playwright perf fixture: CDP CPU throttling, scenario windows, assertions (zero LoAF, INP, handler p95), frame stats as a CI artifact; throttling rate calibrated on CI runners
- [x] `pnpm perf`: the same scenarios on a real machine with frame-pacing assertions
- [x] Budgets in one config read by tests and benches
- [x] Replace the 200 ms LoAF budget in `.cursor/rules/architecture.mdc`, `openspec/config.yaml` quality bar, `photo-card` spec, `react-perf-spa` skill, `LOAF_BLOCKING_BUDGET_MS`; add the 60 fps rule to `docs/lessons.md`
- [x] Cross-origin isolation (COOP / COEP via Workers static-asset headers); verify `crossOriginIsolated` on the preview URL
- [x] Enable React Compiler (or remove the assumption from `react-perf-spa`)
- [x] Existing photo-card import scenario passes the new zero-LoAF gate
