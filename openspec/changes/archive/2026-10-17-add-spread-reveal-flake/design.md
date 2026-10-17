# Design

## Context

See proposal.md. `Pasteboard` already reveals a newly added spread via layout settle + `revealLaidOutSpread`. Fit-zoom + page-role change can leave layout mid-settle; camera `useLayoutEffect` can clobber scroll mid-reveal; restoring `content-visibility` mid-check shifts geometry. Spec already requires full lie-within; e2e uses strict `spreadViewContained` + `expect.poll` — keep both.

## Goals / Non-Goals

**Goals:**

- App-side reveal that ends with the new spread fully inside `pasteboard-scroll` after fit-zoom add.
- Bounded, add-spread-only settle (no fighting unrelated user scroll).
- Public-API unit coverage for settle/retry edges; e2e unchanged in strictness; local `--repeat-each=50` proof.

**Non-Goals:**

- New scrollport or virtualization redesign.
- Looser e2e overlap/tolerances/retries/skip/helper deletion.
- New dependencies.
- Gate-threshold weakening (mutation excludes only for thin React wiring with pure modules mutated — same pattern as `EditorShell` / `usePasteboardCamera`).

## Decisions

1. **Prefer app scroll/settle over test-only waits** — harden reveal so containment sticks after layout/paint. A deterministic e2e wait (fit fill before add; 15s contain poll) is allowed only as settle sync and must not replace or weaken `spreadViewContained`.
   - Alternative rejected: lengthen Playwright poll alone — masks product race.

2. **Settle model: rAF + ResizeObserver + paint double-rAF** — while a pending reveal id is set: retry on rAF/`revealTick`, observe scroll/world resize, and require a double-rAF paint confirm before clearing. Base ceiling `REVEAL_TRY_CEILING = 64`; while clamped at max scroll (extent still growing) use `* 2`. On exhaustion: clear pending reveal and stop.
   - Alternative rejected: ceiling 32 / rAF-only — insufficient under fit+role layout; infinite retry fights the user.

3. **Keep `content-visibility: visible` for the whole pending reveal** — restoring mid-check shifts layout and can clear while still overflowing. Restore only when clearing the pending reveal (success without restore flag, or exhaust with restore).
   - Alternative rejected: restore-then-re-nudge in one turn — observed to clear falsely under paint timing.

4. **Hold camera scroll + fit inset / zoom-out-only delayed fit** — while reveal is pending, skip camera scroll restore that would clobber reveal nudges. Fit uses a 24px viewport inset; delayed fit may only zoom out (never up) after chrome settles.
   - Pure helpers live in `pasteboardCameraFit.ts` (mutated); `usePasteboardCamera` stays excluded wiring.

5. **Composition** — geometry + retry planning in `pasteboardReveal.ts` (mutated); React orchestration in `usePasteboardReveal.ts` (excluded wiring); `Pasteboard.tsx` stays thin chrome (excluded). Unit tests lock pure modules; SpreadTemplateBar RTL + e2e lock the path.

6. **Tests** — `SpreadTemplateBar.test.tsx` for second-nudge success and ceiling exhaustion; `pasteboardReveal` / `pasteboardCameraFit` unit suites; e2e: fitted precondition, strict `spreadViewContained`, plus existing `assertDocumentFitsViewport` / `assertNamedScrollport('pasteboard-scroll')` for empty/happy/scroll smoke on the pasteboard path; skill `ui-review` layout smoke before push (no new branded UI).

## Touch-set

- `src/editor/pasteboardReveal.ts` + `pasteboardReveal.test.ts` — contain/nudge/reveal planning
- `src/editor/pasteboardCameraFit.ts` + `pasteboardCameraFit.test.ts` — fit inset / hold / delayed zoom-out
- `src/editor/usePasteboardReveal.ts` — reveal effect wiring
- `src/editor/Pasteboard.tsx` — wire hook + add-spread begin
- `src/editor/usePasteboardCamera.ts` — call fit helpers + holdScrollRef
- `src/editor/SpreadTemplateBar.test.tsx` — public add-spread reveal cases
- `e2e/spread-view.spec.ts` — deterministic fit fill wait + contain poll timeout; never loosen `spreadViewContained`
- `stryker.config.json` / `stryker.mutate.md` — exclude thin Pasteboard / usePasteboardReveal wiring (reasons documented)
- `openspec/changes/add-spread-reveal-flake/**` — planning artifacts
- `docs/roadmap/M2.1/add-spread-reveal-flake.md` — tick scope via roadmap close

## Risks / Trade-offs

- [Still flakes under CI load] → prove 50/50 locally with `--repeat-each`; keep settle bounded.
- [Settle fights user scroll] → only while add-spread pending id is set; clear on success or exhaustion.
- [Mutation excludes] → pure settle/fit modules remain in mutate scope; wiring excludes match EditorShell pattern.

## Migration Plan

None — behavior hardening only; rollback is revert of the reveal/fit commits.
