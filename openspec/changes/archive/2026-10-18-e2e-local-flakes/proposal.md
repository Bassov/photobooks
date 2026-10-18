# Proposal

## Why

Five functional Playwright cases still flake under `--repeat-each` / CI burn-in: fresh-session Open; mixed-aspect filmstrip gaps; smaller-template unplace; autosave persists across reload; escape cancels move / Delete unplaces. That blocks M2.1’s empty-`@flaky` / zero-retry gate. Fix now so later ratchet items have a clean baseline.

## What Changes

- Diagnose each named flake with a failing-first repeat count; fix via app readiness/state or deterministic e2e waits on app signals — **no** retries, skip, fixme, looser assertions, timeouts, or deleted tests.
- Keep frame-budget / continuous-zoom LoAF flakes out of scope (already moved to `e2e-frame-budget-flakes`).
- Prove each fix with local `--repeat-each=20 --retries=0` on the named cases; CI burn-in and the PR’s integration e2e gate must stay green for them.

## Capabilities

### New Capabilities

_(none — `skip_specs: true`)_

### Modified Capabilities

_(none — no product requirement changes; race/readiness only)_

## Impact

- In: the five named cases above and their e2e helpers; app code that races those waits (session hydrate, filmstrip layout, template apply, autosave, drag-swap keyboard).
- Out: frame-budget / LoAF flake work; gate-weakening-guard / e2e-assertion-ratchet (phase 2).
- Risks: over-fitting waits to one machine; incomplete repeat evidence; accidental assertion weakening (forbidden). Security: File System Access / permission and trusted-path handling stay unchanged — readiness/waits only.

## Success criteria

- Each of the five named cases passes `--repeat-each=20 --retries=0` locally; CI `burn-in` covers them without retries.
- PR integration / non-burn-in e2e gate stays green with no gate weakening.
- No new skip/fixme/retries; no loosened assertions/tolerances/timeouts.
- Over budget → `pnpm roadmap add --after e2e-local-flakes` (one checkbox per leftover case).
