# kit-sync-chrome

Tag: feature
Milestone: P2
Title: Bug: Kit sync W2: top-bar view toggles, no Add spread row, Preview = presentation mode (Designer kit-sync Spec)
Status: done

## Scope

- [x] KS1 (M11 widened, M39): `#/demo` top bar view toggles = snap, grid only (`DEMO_VIEWS` was snap, grid, guides, rulers, overlays, dpi); the `#/demo` canvas opens with guides / rulers / overlays off (no dashed safe lines). Tools toolbar w 210, centre x 676 = canvas centre at 1440×900. Print / Publish stay. Rework (Designer NOT PASS): Snap / Grid 28 × 28, 8 apart, on = rgb(202), x 717 / 753 (prod `EditorTopBar.tsx`); the top bar never overlaps at widths ≥ 1024 (the right group keeps its width and moves the tools aside, the left group truncates)
- [x] KS8 (M17): the spread list has no "Add spread" + Ctrl+↵ row at the bottom (`uikit/src/sandbox/chrome.tsx` `SpreadsPanel`); the row menu "Add after" stays
- [x] KS14 (M16, M53): `#/demo` Preview opens presentation mode as prod `data-testid="presentation"` (`src/render/SpreadPager.tsx`, `src/editor/PresentationMode.tsx`): fixed full-screen, bg `--presentation`, spread fit (94 % w, 96 % of h − 64), starts on the cover, "Esc" chip top-right (top/right 16, h 32, px 12, 12 px, radius full, white/10 bg, white ink), caption bottom centre (bottom 16, 12 px, white/60) "Cover", then "i / n"; Esc closes; ← / → / Space page. New `uikit/src/demo-parts/presentation.tsx`. The site viewer stays, reached from Publish → Open site. Rework (Designer NOT PASS): slides follow every list row after the cover (20 pages: Cover, 1 / 11 = page 1 alone, 2 / 11 – 10 / 11 spreads, 11 / 11 = page 20 alone; single pages one page wide, centred); the cover slide is the kit `CoverSpread` at prod's 0.5 px / mm with texts × cover / 848 (front 61.15 tall, spine 22.93, back 22.93); slides move sideways + fade 200 ms cubic-bezier(0.2, 0.7, 0.3, 1), neighbours mounted, none under reduced motion; caption and Esc `leading-4` (caption text top 868 at 1440×900)
- **Browser check:** `#/demo` editor: top bar shows 4 tools + Snap + Grid centred over the canvas; no dashed guides on a spread; the spread list ends without Add spread; Preview → black presentation on the cover with "Esc" and "Cover", → pages through spreads, Esc closes.
- **Demo:** `uikit#/demo` steps `editor-view-rulers-guide` … `editor-spread-row-menu`, `editor-preview` (walk in `uikit/scripts/demo-capture.mjs`)
- **Test:** kit `uikit/scripts/qa.mjs` checks KS1, KS8, KS14 on `#/demo` (kit10 assertions updated to the new values); demo baselines regenerated
- **Hard nos:** kit-only (`uikit/`); no `src/` change; lanes `context-inspector.tsx`, `inspector.tsx`, `templates.ts`, `index.css`, `canvas.tsx`, `viewport.tsx` untouched; `v7.tsx` only after #412 merged (the rework's `CoverSpread` `slide` prop)
- **UI kit:** `uikit#/demo`; Designer Spec `photobooks-orch/shared/design/kit-sync/spec.md` items 1, 8, 14; tracker KS1, KS8, KS14
