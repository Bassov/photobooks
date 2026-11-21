# design-r32-crop-kit

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r32-crop-kit
Status: done

## Scope

- [ ] Round 32 of the Designer parity walkthrough-ux-review §A (2026-11-21, NOT PASS), kit Musts M127–M128. Kit-only; prod is `design-r32-crop-prod`.
- [ ] M127: in `#/demo` pinned crop, Tab only cycles the photo handles; the kit's global Tab-hides-panels handler skips while pinned (kept elsewhere), so the canvas does not re-fit.
- [ ] M128: the FrameChrome "Crop · N%" tag and the crop-overlay tag in `uikit/src/sandbox/canvas.tsx` get `leading-4` (16 px line, 20 px tall, as the rotate chip).
- **Done when:** kit e2e pins Tab in pinned crop → panels stay, frame width unchanged (±0.5), focus moves to the next photo handle; both tags have computed line-height 16 and height 20 (±0.5). Only changed demo screenshots re-baselined. `pnpm roadmap check` green.
- **Browser check:** kit `#/demo` via the kit direct-crop e2e spec (`qa.mjs` is frozen).
- **Hard nos:** no `src/**`, `uikit/scripts/qa.mjs`, `e2e/fixtures/**`.
- **Test:** e2e kit direct-crop spec (extended).
- **Depends:** `photo-pick-kit` (done).
