# snapping-engine

Tag: prep
Milestone: M4
Title: pure snapping
Status: done

## Scope

- [x] Snapping engine: trim / bleed edges, margins, grid columns / rows (from `resolveLayoutGrid`), guides, page center, other frames' edges and centers, equal gaps; returns corrected rect + active guide lines — delivered here: frame edges / centers and page anchors (trim, spine, page center, center); grid columns / rows → `layout-grids-snap-wire`, guides → when guides ship, equal-gap distribute → multi-select (deferred)
- [x] Anchor index built once at gesture start; per-move query allocation-free; `pnpm bench` budget per query on a dense spread

- **Kit components:** `anchors`, `snapRect`, `SnapLine` (`uikit/src/sandbox/model.ts`); live lines + `data-testid="snap-line"` in `uikit/src/sandbox/canvas.tsx`; TopBar view toggle `snap` (`Magnet`, Shift+S) in `chrome.tsx`.
- **Demo:** no dedicated pages.json slug — exercise in editor with ≥2 frames (free-frames / handles). Related interactive: `free-frames`, `frame-selection-handles`.
- **Musts:**
  - Snap toggle: TopBar Magnet + Shift+S; quiet gray pressed when on. Default on is fine.
  - While moving/resizing an unlocked frame (handles gestures): edges + center snap to other frames (edge + frame center) and page anchors (trim, spine, page center / center). Exclude the dragged frame(s) from anchors.
  - On snap: show ≤1 line per axis — 1.5px quiet dark stroke + pill label `snap · {kind}` (`frame` / `frame center` / `trim` / `spine` / `page center` / `center`). Label = bg-field, 2xs, not a toast.
  - Alt while drag → no snap (no lines). Snap off → no lines. Lines clear on pointer up.
  - Threshold ~ few mm at 100% zoom (kit uses mm th; keep zoom-aware if cheap).
- **Hard nos:** no grid column/row snap yet (that is layout-grids-snap-wire); no guide snap until guides ship; no blue/teal/magenta snap strokes (kit color-theme bleed/guide colors are demo-only); no toast; no multi-select distribute.
- **Tokens:** snap stroke quiet dark gray (product: `#393738` / grayscale `--bleed` or equivalent — not pink); label `bg-field` + foreground text; no `#2f9e9a`.
- **Test:** two frames → drag until edges align → `snap · frame` line appears; Alt-drag → no line; Shift+S off → no line.
- **Depends:** frame-selection-handles (on main). Soft: free-frames.
