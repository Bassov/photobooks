# photo-pick-kit

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item photo-pick-kit
Status: done

## Scope

- [ ] Kit part (`#/demo`) of the Designer feature "frame context menu" (Owner Q-24 2026-11-20: Replace by picking from the filmstrip), Must FM2 only: Designer spec `frame-context-menu` M3 and Spec "Pick mode" + "Kit". Prod is `photo-pick` (FM4).
- [ ] `uikit/src/sandbox/store.tsx`: `startPick` sets the pick status and keeps the frame selected; `endPick`; `placePhoto` (the drop's replace / place, one undo step "Replace photo" / "Place photo") shared by the frame drop and the pick.
- [ ] `uikit/src/sandbox/chrome.tsx`: filmstrip ThumbGrid `data-picking` (`box-shadow: inset 0 0 0 2px var(--select)`), thumbs `cursor: copy`, hovered / focus-visible thumb gets the selected tone, focus moves to the roving thumb; click / Enter on a thumb picks.
- [ ] `uikit/src/sandbox/canvas.tsx`: the frame tag "Replacing" / "Placing" (crop-tag look, left 0, top −24).
- [ ] `uikit/src/sandbox/frame-menu.tsx`: Replace / Place rows enabled when not locked and the gallery has ≥ 1 photo.
- [ ] `uikit/src/sandbox/viewport.tsx`: Esc ends the pick before any other Esc layer; cancel on pointerdown outside the dock, active spread change, frame removed / locked, Masters, Preview.
- [ ] `uikit/scripts/demo-capture.mjs`: steps `editor-frame-menu`, `editor-photo-pick`, `editor-photo-picked`; re-baseline locally.
- **Done when:** every pick-mode line of the Spec works in `#/demo`, pinned by `e2e/kit-photo-pick.spec.ts` with Spec values (ring, cursor, status text, tag): Replace photo… → `data-picking` + status → click thumb 3 → frame photo = thumb 3, one undo step; Enter on a focused thumb picks; Esc cancels with no op; Place on an empty frame; locked frame → rows disabled. Demo steps captured; `pnpm roadmap check` green.
- **Browser check:** kit `#/demo` via `e2e/kit-photo-pick.spec.ts` (new; `qa.mjs` is frozen).
- **Hard nos:** no `src/**`, `uikit/scripts/qa.mjs`, `e2e/fixtures/**`, `.github/**`, `stryker.config.mjs`, `openspec/specs/**`.
- **Test:** e2e `e2e/kit-photo-pick.spec.ts` (new).
- **Depends:** `frame-menu-kit`, `filmstrip-resize-kit`, `direct-crop-kit` (done).
