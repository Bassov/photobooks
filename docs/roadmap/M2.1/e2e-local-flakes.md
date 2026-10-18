# e2e-local-flakes

Tag: prep
Milestone: M2.1
Title: Stabilize functional e2e flakes (open-save, filmstrip gaps, template-unplace, autosave, drag-swap)

## Scope

- [x] Stabilize without weakening assertions, retries, skip, tolerances or timeouts (the `agent-rules` quality-bar rule; the mechanical guards `gate-weakening-guard` / `e2e-assertion-ratchet` follow in phase 2 and must find nothing to flag here); fix in app code or with deterministic waits on app state
- [x] `open-save › fresh session Open loads saved book with thumbs and frames`
- [x] `filmstrip › mixed aspect cards pack with uniform gaps…`
- [x] `template-unplace › a smaller template unplaces overflow photos…`
- [x] `autosave › autosave persists edits across reload without manual Save`
- [x] `drag-swap › escape cancels a move source and Delete unplaces a focused frame`
- [x] Each fix gets a failing-first reproduction (a repeat count that failed before). Over budget → growth rule (one checkbox per spec)
- [x] Moved to `e2e-frame-budget-flakes`: the drag-place frame-budget and continuous-zoom LoAF flakes
- **Done when:** each named test passes `--repeat-each=20 --retries=0` locally and in the CI `burn-in` step, and `integration` is green on three consecutive `main` runs with no flaky retries for these tests.
- **Size:** ~800 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** PR #80 S2, PR #81 N4

## Done note

Shipped: sync thumb publish; bookStore rAF+32ms watchdog flush; ConnectedSpreadView thumb fallback+subscribeThumb; e2e bringToFront/focus asserts; removed template-unplace retries. Frame-budget LoAF flakes remain in e2e-frame-budget-flakes.
