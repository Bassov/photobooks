# Design

## Context

See proposal.md. Five named cases flake under local/`--repeat-each` (PR #80 S2). `template-unplace` still uses `test.describe.configure({ retries: 2 })` around the overflow case — that must go once the race is fixed. Lessons already cover adopt-on-open, aspect packing, and DerivedCache hash awaits; apply may harden those seams, not invent new layers.

## Goals / Non-Goals

**Goals:**

- Each named case green at `--repeat-each=20 --retries=0` (and CI burn-in when those specs change).
- Prefer app readiness / settle over test-only sleeps; e2e may wait only on existing DOM/status signals without loosening assertions.
- Remove suite-level Playwright retries that cover any in-scope named case.

**Non-Goals:**

- Frame-budget / LoAF flakes (`e2e-frame-budget-flakes`).
- Gate-weakening-guard / e2e-assertion-ratchet.
- New dependencies, scrollports, or product UX redesign.
- Raising timeouts / tolerances / skip / fixme / retries as a “fix”.

## Decisions

1. **Failing-first per case** — before changing code, record a repeat count that fails (`--retries=0`). After the fix, prove 20/20 on that grep. Over budget → `pnpm roadmap add --after e2e-local-flakes` (one case per leftover checkbox).
   - Alternative rejected: fix all five blindly without evidence.

2. **Prefer app settle over `waitForTimeout`** — hydrate/open/autosave/template/keyboard races fixed in session, filmstrip packing, or editor status paths when the flake is product timing. Deterministic `expect` / `expect.poll` on existing testids is allowed as sync, not as weaker assertions.
   - Alternative rejected: bump timeouts or keep `retries: 2`.

3. **Strip in-scope Playwright retries** — delete `retries: 2` from the `template-unplace` describe that wraps the named overflow case once stable. Do not add retries elsewhere.
   - Alternative rejected: leave retries “for CI safety”.

4. **Shared fixtures only** — reuse listed fixtures below. Add at most one new shared readiness helper under `e2e/fixtures/` if two+ cases need the same signal.
   - Public API under test: editor DOM + `__photobooksProject` OPFS test hooks (open-save).

5. **Composition** — keep fixes in the candidate modules below; extract pure helpers only when mutation/unit coverage needs a seam. Apply may **narrow** this set; must **not expand** without a design update.

6. **Lock-in assertions (must remain):**
   - fresh-session Open: thumbs + `spread-frame-image` counts; `Book restored`; `assertDocumentFitsViewport` + `assertNamedScrollport('pasteboard-scroll')`
   - mixed-aspect gaps: gap delta `< 2` and expected gap in `(4, 20)` (no looser band)
   - smaller-template unplace: `filmstrip-placed` count 1 + status `1 photo was unplaced…` + document fit
   - autosave: post-reload `Book restored`, frame count, 2-up checked, `Saved` + document fit / pasteboard scrollport
   - escape/Delete: pressed/Cancel move cleared; `spread-frame-image` / `filmstrip-placed` counts after Delete

## Security

File System Access / OPFS test hooks and permission prompts stay unchanged — readiness and waits only.

## Touch-set

**E2E**

- `e2e/open-save.spec.ts`, `e2e/filmstrip.spec.ts`, `e2e/template-unplace.spec.ts`, `e2e/autosave.spec.ts`, `e2e/drag-swap.spec.ts`
- `e2e/fixtures/openSessionEditor.ts`, `ensurePhotoFixtures.ts`, `assertDocumentFitsViewport.ts`
- Optional new: `e2e/fixtures/waitForEditorReady.ts` (only if shared)

**App (apply landed here; no further expand without design update)**

- `src/editor/thumbCache.ts` (+ `.test.ts`) — publish thumbs on decode (no rAF-only queue); background-tab freeze fix
- `src/editor/bookStore.ts` (+ `.test.ts`) — dual-schedule gallery/meta flush (rAF + ~32ms `setTimeout` watchdog)
- `src/editor/ConnectedSpreadView.tsx` (+ `.test.tsx`) — filmstrip thumb preview fallback + `subscribeThumb` until tier ready
- Open/hydrate (unchanged callers): `projectSession.ts`, `pendingHashes.ts`, `previewAspect.ts`
- Escape/Delete / template paths exercised via e2e only this change

**Meta**

- `openspec/changes/e2e-local-flakes/**`, `docs/roadmap/M2.1/e2e-local-flakes.md`

No quality-gate config edits.

## Risks / Trade-offs

- [Still flakes under CI] → prove 20/20 locally; PR burn-in for changed specs.
- [Over budget] → grow roadmap; ship stable subset.
- [Masking with sleeps] → forbidden.

## Migration Plan

None — hardening only; rollback is revert.
