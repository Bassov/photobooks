# Design

## Context

See proposal.md. Three named LoAF scenarios still carry `retries: 2` inside the `frame-budget gates` describes in `e2e/drag-place.spec.ts` and `e2e/spread-view.spec.ts`. Budgets stay in `src/perf/budgets.ts`. Lessons: zero LoAF is the product gate; do not pace publishes on rAF alone under parallel Playwright. Post-#89 hunch (verify, not assume): every mounted `ConnectedSpreadView` re-renders on any thumb publish via `subscribeThumbPublishes`.

## Goals / Non-Goals

**Goals:**

- Named three cases green at `--repeat-each=20 --retries=0` locally and CI burn-in.
- Root-cause from Playwright LoAF traces; fix app pacing or make the measurement window deterministic without dropping the zero-LoAF assert.
- Remove `retries: 2` only from describes that wrap fixed in-scope cases (nest/split if siblings remain flaky).

**Non-Goals:**

- Other retry suites (`filmstrip`, `drag-swap`, pasteboard scroll / template switch / autosave-during-drag) unless the same fix is free.
- New subsystems, dependencies, UX redesign, or budget/tolerance changes.

## Decisions

1. **Failing-first per case** — reproduce with `--retries=0` (and a short `--repeat-each`) before code changes; after each fix prove 20/20 on that grep. Over budget → `pnpm roadmap add --after e2e-frame-budget-flakes`.
   - Rejected: keep retries or loosen asserts.

2. **Prefer app pacing over test sleeps** — candidate seams (narrow during apply; do not expand without design update):
   - `ConnectedSpreadView` + `thumbCache`: replace global `subscribeThumbPublishes` with per-asset `subscribeThumb` for assets on that spread (unit: existing ConnectedSpreadView / thumbCache tests).
   - `usePasteboardCamera`: coalesce settle / commit work during continuous zoom so LoAF does not fire in the measured window.
   - `galleryDrop` / `projectSession.saveBookNow`: keep dragover hot path ≤ budget; defer non-urgent save work off the drag frame if save-during-drag LoAF is sync save cost (defer/schedule only; same write path — no new FS / postMessage / blob surface).
   - E2E: phase LoAF windows (clear between zoom-in / tier / zoom-out burst); `dispatchCtrlWheel(..., { settleMs: 0 })` for measured bursts, then settle wait outside the assert. Never raise LoAF max.
   - Rejected: broader CPU throttle, deleting asserts, measuring settle remount LoAF without pacing (deferred to `continuous-zoom-settle-mount-pace`).

3. **Retry removal shape** — nest fixed cases under `retries: 0` when siblings still need `retries: 2`. Do not leave `retries: 2` on a describe whose only purpose is the fixed cases.

4. **Composition** — keep fixes in existing editor modules; extract a pure helper only when unit/mutation needs a seam. Public API under test: DOM + `__photobooksPerf` / existing painter fixture; reuse `e2e/perf/perfFixture.ts`.

5. **No gate-config edits** — `budgets.ts`, Playwright global retries, coverage/mutation thresholds stay untouched.

## Touch-set

**E2E**

- `e2e/drag-place.spec.ts` — zoomed-out gallery drag; save during drag; retry nesting/removal
- `e2e/spread-view.spec.ts` — continuous zoom; retry nesting/removal
- `e2e/fixtures/dispatchCtrlWheel.ts` — document burst + settle wait (app coalesces)
- `e2e/perf/perfFixture.ts` — only if measurement-window ordering needs a shared helper

**App (apply may narrow)**

- `src/editor/ConnectedSpreadView.tsx` (+ `.test.tsx`)
- `src/editor/spreadPreviewKeys.ts` (+ `.test.ts`) — per-spread thumb/tier snapshot keys
- `src/editor/thumbCache.ts` (+ `.test.ts`) — only if subscribe API changes
- `src/editor/usePasteboardCamera.ts` (+ existing camera tests if present) — wheel delta coalesce (file stays mutation-excluded chrome; logic covered by `cameraGesture` tests)
- `src/editor/galleryDrop.ts` and/or `src/editor/projectSession.ts` (+ tests) — only if drag/save LoAF traces point here

**Meta**

- `openspec/changes/e2e-frame-budget-flakes/**`, `docs/roadmap/M2.1/e2e-frame-budget-flakes.md`

No quality-gate config edits. No new scrollports (existing pasteboard asserts stay as-is).

## Risks / Trade-offs

- [CI still flakes after local 20/20] → burn-in is the proof; fix or roadmap leftover cases.
- [Global thumb fix insufficient for zoom/drag] → follow traces into camera/drop/save; do not guess.
- [Per-asset subscribe misses reset-all] → `resetThumbCache` must still notify; cover in unit tests.
- [Over budget] → ship stable subset; add follow-up item.

## Migration Plan

None — hardening only; rollback is revert.

## Open Questions

None — first failing repeat + LoAF attribution in apply answers which seam ships.
