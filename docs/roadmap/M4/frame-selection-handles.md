# frame-selection-handles

Tag: feature
Milestone: M4
Title: direct manipulation
Status: done

## Scope

- [x] Select a frame; SVG handle overlay; move, resize and rotate by dragging
- **Perf:** drag / resize preview in the overlay and on the frame's `transform`; op committed at gesture end. Gate: drag a frame across a dense spread — zero LoAF, `pointermove` p95 ≤ 2 ms.
- **Browser check:** move, resize and rotate a frame with handles — handles never lag behind the cursor.
- **UI ref:** `uikit#/feature/frame-selection-handles`
- **UI kit:** `uikit/src/features/m4.tsx:47-50` (`frame-selection-handles` demo + notes), `UI ref: uikit#/feature/frame-selection-handles` — select/move/resize/rotate handles
- **Kit components:** Handles + frame pointer handlers in `uikit/src/sandbox/canvas.tsx` (`data-testid` handles / sel-outline / sel-handle); selection outline pattern in `uikit/src/spread.tsx` (`Selection` — not exported, visual SoT only). Feature flags `handles`, `rotateHandle` on sandbox features.
- **Demo:** `frame-selection-handles` → `uikit/src/features/m4.tsx`
- **Musts:**
  - Click frame → select (Select tool). Esc / click empty → deselect. Single selection only this slice (no Shift/marquee — that is multi-select).
  - Selected unlocked frame: 2px `#232223` outline + white ring; 8 white square handles (nw/n/ne/w/e/sw/s/se) with `boxShadow 0 0 0 1.5px #232223`; round rotate handle above center (same white + 1.5px `#232223`).
  - Body drag → move; handle drag → resize (min 5 mm each edge); rotate handle → rotate (Shift = 15° steps). Shift+resize keeps proportions; Alt = from center / no snap if snap exists.
  - Arrow keys nudge 1 mm (Shift = 10 mm). One pointer gesture = one history step.
  - Locked frame: outline only, no handles; quiet status if user tries to move (`Frame is locked…`).
  - Size label under selection optional (W × H mm, quiet tag) — kit has it; include if cheap.
- **Hard nos:** no floating `FrameToolbar`; no multi-select/marquee/align; no grid-snap labels required (snap-wire later); no blue; black only on sel outline + handle rings; no permanent frame borders when unselected (hover may show quiet outline at ≤70% opacity).
- **Tokens:** outline/handle ring `#232223`; handle fill `#fff`; size tag `bg-tag` / quiet dark pill ok; unselected hover `outline-select/70` only.
- **Test:** select photo → 8 handles + rot visible; drag body moves; corner resize stops at 5 mm; Esc clears sel; locked frame → no handles.
- **Depends:** frame-geometry-schema, frame-transform-ops (on main). Soft: snapping-engine / snap-wire later. Does not need free-frames.
