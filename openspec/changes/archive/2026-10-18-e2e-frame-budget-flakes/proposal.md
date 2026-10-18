# Proposal

## Problem

Three frame-budget e2e scenarios flake under `--repeat-each` / CI burn-in: `drag-place` zoomed-out gallery drag, `drag-place` save during drag, and `spread-view` continuous zoom. Their describe blocks still use `retries: 2`, which hides real LoAF failures.

## Why now

M2.1 requires zero Playwright retries on fixed suites. Budgets in `src/perf/budgets.ts` must not change; stability must come from root-cause fixes and CI burn-in, not retries.

## Scope in

- The three named scenarios above.
- Root-cause each LoAF in those measurement windows; fix pacing or make the window deterministic while keeping the zero-LoAF assert.
- Remove `retries: 2` from the describe blocks that wrap the fixed scenarios once stable.

## Scope out

- Other frame-budget describes still on retries (`filmstrip`, `drag-swap`, pasteboard scroll / template switch) unless the same fix is free.
- Changing budget numbers, tolerances, skips, or other gate weakening.
- Spec / SHALL text changes (`skip_specs: true`; existing `frame-budget` requirements already mandate these scenarios).

## Success criteria

- The three scenarios pass `--repeat-each=20 --retries=0` locally and in CI `burn-in`.
- Fixed cases live under nested describes with `retries: 0` (no `retries: 2`); out-of-scope siblings may keep retries.
- `PERF_BUDGETS` / `src/perf/budgets.ts` unchanged.

## Risks

- Over-scoping into unrelated LoAF suites.
- Measurement-window tweaks that hide jank instead of fixing pacing (zero-LoAF assert must remain).
