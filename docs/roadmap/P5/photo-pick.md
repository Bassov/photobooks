# photo-pick

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item photo-pick
Status: done

## Scope

Designer Spec frame-context-menu FM4 (prod pick mode = kit FM2, #670; Owner Q-24 decided 2026-11-21).

- [x] `src/editor/photoPick.ts` store: `startPhotoPick({ spreadId, frameId, kind })`, `endPhotoPick()`, `pickPhoto(assetId)` dispatching `replace` / `place` as one undo step ("Replace photo" / "Place photo"); status texts kept while on; cancel on Esc (first Esc layer), pointerdown outside the dock, active spread change, frame removed / locked, Pages → Masters, Preview open; pointerdown inside the dock keeps the mode.
- [x] Filmstrip: `data-picking` → `box-shadow: inset 0 0 0 2px var(--select)`, thumbs `cursor: copy`, click / Enter on a thumb picks, focus moves to the roving thumb on start.
- [x] Frame tag "Replacing" / "Placing" in the `.spread-frame-crop-tag` look.
- [x] `FrameContextMenu.tsx`: two rows only, "Replace photo…" (filled photo frame) / "Place photo…" (empty photo frame), enabled when not locked and the filmstrip has ≥1 photo (`frame-menu-replace` / `frame-menu-place`); existing rows unchanged (full menu = FM3).
- **Browser check:** `e2e/photo-pick.spec.ts`: Replace photo… → status + `data-picking` (ring paint sample) → click thumb 3 → frame asset = thumb 3, one undo step; Enter on a focused thumb picks; Esc cancels with no op; Place photo… on an empty frame; locked frame → rows disabled; pointerdown in the dock keeps the mode, outside cancels.

## Done when

1. Every pick-mode line of the Spec works in prod, pinned by unit + `e2e/photo-pick.spec.ts` with kit values (ring 2 px `--select`, cursor copy, status texts, tag 11/600 line 16 top −24).
2. Exactly one history entry per pick; Undo restores the old asset; Esc / cancel adds none.
3. Existing FrameContextMenu unit / e2e tests green unchanged (only additions).
