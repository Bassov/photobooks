# look-parity-rulers

Tag: feature
Milestone: M4
Title: look parity: mm rulers (kit look, no guides)
Status: done

## Scope

Look parity (Owner 2026-10-29: the editor must look exactly like the UI kit; no fake / disabled controls). This is the **visual look-parity subset of [`rulers`](../P2/rulers.md)**: the kit mm rulers, cursor tick, corner "mm" square and visibility toggle. No guide creation (see [`guides`](../P2/guides.md)).

- [x] Pure tick math (`rulersMath`): mm to px at zoom, major step by scale (>2.4 → 5, >1.2 → 10, else 20 mm; coarser 50 / 100 / … mm below that so labels never overlap at the pasteboard's low zooms), range culling, page-local X labels that wrap at the spine
- [x] 22 px X / Y rulers (`ruler-x` / `ruler-y`) with mm ticks and labels that follow scroll / zoom of the active spread; spine marker on X; corner "mm" square
- [x] Cursor tick on pointer move over the pasteboard, cleared on leave, only while rulers are visible
- [x] Rulers toggle in the top bar (same group as Layout grid / Snap, "Rulers (Shift+R)") and `Shift+R` hotkey (typing-target guard); default off
- [x] Pasteboard content inset by 22 px while rulers are on

**Done when:** with rulers on the pasteboard shows kit rulers aligned with the active spread through scroll and zoom; the toggle and `Shift+R` show / hide them; default off; no accent colour.
**Browser check:** toggle rulers, scroll and zoom; ticks stay on the spread edges, label resets to 0 at the spine, cursor tick follows the pointer.
**Perf:** drawn on a `<canvas>` from scroll / camera rAF; no React re-render per frame; zero LoAF.

- **Kit components:** `Ruler` and `Viewport` rulers block (`uikit/src/sandbox/viewport.tsx` l.83-108, 212, 228-233); ViewKey `rulers` (`uikit/src/sandbox/chrome.tsx` l.61-64).
- **Demo:** `rulers` → `uikit/src/features/pages.tsx`
- **Musts:**
  - 22 px rulers with mm ticks / labels following scroll and zoom (kit math), cursor tick, corner "mm" square, topbar toggle + `Shift+R`, default off.
  - Tokens only, no accent colour.
- **Hard nos:** no guide dragging / creation from rulers (no "Drag to create a guide" title, no s-resize / e-resize cursors); no snap to rulers; no Inspector changes; no Preview / PDF rendering of rulers; no new colours.
- **Tokens:** `--chrome`, `--muted-foreground` (ticks at 50%), `--select` (spine at 50%), `--bleed` (cursor tick), `--text-2xs`.
- **Test:** unit — tick math (step thresholds, mm↔px, spine wrap, culling), visibility store, toggle; e2e — topbar toggle and `Shift+R` show / hide `ruler-x` / `ruler-y`.
- **Depends:** free-frames, layout-grids-render-snap, look-parity-scrollbars
