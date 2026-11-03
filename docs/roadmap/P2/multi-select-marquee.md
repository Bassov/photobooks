# multi-select-marquee

Tag: feature
Milestone: P2
Title: marquee selection
Status: done

## Scope

- [x] Marquee selection from the paper or the pasteboard with the Select tool (Designer Spec `shared/design/multi-select/spec.md` "Canvas", marquee bullets): starts after 3 px (`MOVE_SLOP_PX`), targets the spread under the press (on the pasteboard, the editable spread with the nearest paper, made active past the slop — Designer RESUME 1; a click under 3 px stays `pasteboardClickSpreadId`), selects every frame whose visible AABB it touches; Shift at pointerdown unions with the selection; Esc cancels and restores it; Hand / Space-pan never start one
- **Prod:** `src/editor/Pasteboard.tsx` (marquee start + overlay), `frameGesture.ts`, `snapIndex.ts` (rect hit query if missing)
- **Kit:** `uikit/src/sandbox/viewport.tsx` marquee from the pasteboard (spread under the press or the nearest one); `uikit/src/sandbox/canvas.tsx` Shift-union and live hit outlines
- **Perf:** live hits through the spatial index every animation frame, not a DOM scan; a marquee over a full spread stays smooth.
- **Browser check:** on a full-bleed spread, drag a marquee from the pasteboard across two frames: both are selected.
- **Kit components:** `uikit#/feature/frame-selection-handles` (`uikit/src/features/pages.tsx` page `frame-selection-handles`); parts: `uikit/src/sandbox/viewport.tsx`, `uikit/src/sandbox/canvas.tsx`
- **Musts:** marquee from the paper or the pasteboard
- **Hard nos:** no fake, dead or disabled-stub controls; no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** marquee fill `rgb(35 34 35 / .10)`, `outline: 1px solid #8E8E8E` (`--color-mark`), square corners, screen px
- **Test:** `src/editor/Pasteboard.click.test.tsx` (click unchanged, drag → marquee); e2e `e2e/multi-select.spec.ts`: a marquee from the pasteboard over a full-bleed spread selects every frame it touches; a marquee over a full spread passes the drag-swap frame-budget gates
- **Depends:** multi-select-move
- **UI kit:** `uikit#/feature/frame-selection-handles` (`uikit/src/features/pages.tsx` page `frame-selection-handles`)
