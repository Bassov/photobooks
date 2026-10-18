# Design

## Context

See proposal.md. `Pasteboard` mounts `spreadIds.slice(start, end)` from `pasteboardWindow` in one render when committed zoom shrinks stride. Main-parity e2e asserts LoAF after default `settleMs` (200) without waiting for gesture-end remount; that case still sits under parent `retries: 2`. Lessons: zero LoAF; no budget/retry weakening; local flake proof ≤ short targeted runs — CI burn-in owns `--repeat-each=20`.

## Goals / Non-Goals

**Goals:**

- Pure paced expand toward the target pasteboard window; always cover the visible port; finish whole-book mount by gesture end.
- Extend main-parity zoom-out LoAF through gesture-end remount; nest under `retries: 0`.

**Non-Goals:**

- Changing `pasteboardWindow` math, budgets, filmstrip pacing, or other frame-budget suites.
- New subsystems / dependencies.

## Decisions

1. **Pure pace helper** — export `pacePasteboardWindow({ current, target, viewportCover, maxNewMounts })` from `pasteboardWindow.ts`. Each step grows the mounted index range toward `target` by at most `maxNewMounts`, preferring `viewportCover` before overscan. Drop indices that left `target` immediately; if no overlap, start empty at `target.start`.
   - Rejected: sleep in e2e; loosen LoAF; uncapped cover union (fit-all cover = full stack → one-frame flood).

2. **Wire in Pasteboard** — hold paced `{start,end}`; render slots from paced range; spacers from paced lead/tail (full-stack extent). Bootstrap from viewport cover on cold start; force-include add-spread reveal index when it enters the target. On target change, rAF + ~32ms watchdog advances (lesson 25 dual-schedule).
   - Rejected: pacing inside `ConnectedSpreadView`; changing camera settle timing to dodge remount.

3. **Cap** — `PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME` (=1). Cover is preferred within the cap, not uncapped.

4. **E2E** — move main-parity case under `retries: 0`; after `dispatchCtrlWheel` (default settleMs), wait until `dataset.gesture` clears / gesture end and 40 slots mounted, then `assertNoLoafEntries(0)`. Use `assertDocumentFitsViewport`; omit `assertNamedScrollport` here when fit-all may not overflow the pasteboard port. Do not add `--repeat-each` locally beyond one green targeted run (CI burn-in is proof).
   - Public API under test: painter fixture + `__photobooksPerf` + pasteboard slots; reuse `dispatchCtrlWheel`, `enablePerfScenario`, `assertDocumentFitsViewport`.
   - Unit: pace helper + Pasteboard wiring (raf stub like existing view tests).

5. **Composition** — thin Pasteboard effect over pure helper; no god-file growth. UI lock-ins for this change: happy-path continuous zoom-out + gesture-end interact (main-parity e2e). Empty gallery/pasteboard is N/A for pace (0 spreads → no-op); existing empty/fixture coverage stays green. Run skill `ui-review` before push.

## Touch-set

- `src/editor/pasteboardWindow.ts` (+ `pasteboardWindow.test.ts`) — pace helper
- `src/editor/Pasteboard.tsx` (+ `Pasteboard.view.test.tsx`) — paced mount state / rAF
- `e2e/spread-view.spec.ts` — gesture-end LoAF window; `retries: 0` nesting
- `openspec/changes/continuous-zoom-settle-mount-pace/**`, `docs/roadmap/M2.1/continuous-zoom-settle-mount-pace.md`
- Delta specs under the change (sync on archive)

No quality-gate config edits. No new scrollports.

## Risks / Trade-offs

- [Visible holes if viewport-cover is wrong] → always union `overscanPx: 0` window before pacing; unit-test the cover invariant.
- [Cap too low delays whole-book mount past settle] → e2e waits gesture end; raise cap only if needed without flooding one frame.
- [Hidden-tab rAF stall] → dual-schedule watchdog like gallery flush.

## Migration Plan

None — behavior hardening; rollback is revert.
