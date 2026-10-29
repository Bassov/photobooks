# canvas-frame-chrome

Tag: feature
Milestone: M4
Title: look parity: canvas frame chrome (size tag, hover, empty/missing, lock, chips, rotate handle)

## Scope

## Scope

Look parity (Owner 2026-10-29: the editor must look exactly like the UI kit `uikit/` v0.9.3; no fake / disabled controls). Visual-only canvas frame chrome in `SpreadView`; no new behaviour, drop logic or hit-testing. All of it is editor chrome (frames with a control), never in thumbnails / render / PDF.

- [x] Size tag (`-bottom-7`, `rounded-md`, `--color-tag` bg, white, `px-1.5 py-0.5`, `text-2xs`, `font-medium`, `tabular-nums`)
- [x] Hover outline on unselected frames (1px `--select` at 70 %, outline-colour transition)
- [x] Empty frame: `--placeholder` / `--placeholder-fg`, ImagePlus 16 px at .7 above 46 on-screen px, "Drop photo" above 110 px; dashed outline removed
- [x] Missing photo: hatch kept, warning triangle (16 px) and "‹name› not found" (`text-2xs`, `font-medium`) above 110 px
- [x] Lock badge (`top-1 right-1`, 20 px round, black at 55 %, white Lock 12 px) when `data-locked`
- [x] Drop and crop chips `rounded-md`; drop chip `shadow` and `px-2`
- [x] Rotate handle: 1x20 px line at top -22 px, 12 px knob at top -28 px with a 1.5 px ring

**Done when:** a selected frame shows the kit size tag and rotate handle, unselected frames outline on hover, empty / missing / locked frames show the kit icons, labels and badge; grayscale tokens only.
**Browser check:** hover, select, lock, empty and missing frames at several zooms; thresholds follow the on-screen frame width.
**Perf:** CSS-only chrome plus static icons; no per-frame JS.

- **Kit components:** `FrameBody`, `FrameEl`, `Handles` (`uikit/src/sandbox/canvas.tsx` l.72-79, 119, 123-124, 128, 226-230, 446).
- **Demo:** `uikit/src/sandbox/*` canvas
- **Musts:**
  - Items above, grayscale tokens only, visual only.
- **Hard nos:**
  - No fake or disabled controls; no new behaviour, drop logic or hit-testing; no `src/editor/*` or `src/ui/*` changes; no masters / cover / guides / photo-rotate / multi-select / Align; no new accent colours; no chrome in preview / PDF.
- **Tokens:** `--color-tag`, `--select`, `--placeholder`, `--placeholder-fg`, `--ink-warning`, `--radius-md`, `--shadow-sm`, `--text-2xs`.
- **Test:** unit — empty-frame icon / text thresholds, missing name label, lock badge only when locked, no dashed outline; e2e — hover outline, size tag + rotate handle on select, "Drop photo" on an empty frame.
- **Depends:** look-parity-canvas-sel, look-parity-page-labels
