# cover-editor-kit

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item cover-editor-kit

## Scope

Item 2 of the Designer `cover-editor` Spec (2026-11-05): the kit (`uikit/`) side of the printed cover sheet. Item `cover-editor` (prod) ports it.

- [ ] `uikit/src/sandbox/v7.tsx`: `SPINE` → page-count spine `spineCm(pages)` (8 + 0.2 mm/page, pages clamped 20–120); constants `WRAP` 1.5, `HINGE` 0.8, `SAFE` 0.5 cm; `coverW(b, pages)` includes it (Spec D1, D2)
- [ ] `CoverSpread big` = the Spec layer stack: sheet paint (`cover-sheet`), closed cover with `shadowBig` placed inside the wrap band, front photo layer incl. the wrap (D4), hinge strips, safe frames `cover-safe-back` / `-front`, wrap veil `cover-wrap`, chip `cover-wrap-chip` "Wrap 15 mm" only while the band is ≥ 18 px (D6); cover text sizes in cqw of the closed cover
- [ ] Spine text rule (canvas and mini): absolutely centred, size min(12 at 848, 0.5 × spine), length capped at trim height − 2 × safe with an ellipsis (D5)
- [ ] Cover inspector: head sub `Hardcover · wrap 15 mm · hinge 8 mm`; Spine width from `spineCm`; hint `Generic print profile · {pages} pages` (`, printed as 20` under the minimum)
- [ ] `coverW` callers pass the page count: `viewport.tsx`, `chrome.tsx`, `demo-parts/site.tsx`, `features/site-viewer.tsx`, `demo-parts/presentation.tsx`
- [ ] `viewport.tsx`: the cover camera fits the sheet; Back / Spine / Front labels 10 px under the sheet; the CoverDrop outline sits on the sheet
- [ ] `features/pages.tsx` `cover-editor`: a third state "120 pages" (60 spreads, cover done) and the updated notes
- **Kit components:** sandbox `CoverSpread`, cover inspector, viewport camera
- **Demo:** `#/demo` steps 09 `editor-cover-selected` and 13 `editor-cover-photo-and-title` change (baseline capture as evidence; baselines are not tracked)
- **Browser check:** kit `#/full/cover-editor` at 1440 × 900, 19 × 23 cm, 20 pages: sheet 848 × 522.47, cover 787.73 × 462.18, spine 24.11, wrap 30.14, hinge 16.08 px (±0.5); "120 pages": spine 61.39 px; spine text centred; A3 landscape: no chip
- **Done when:** kit qa checks lock the sizes above (±0.5 px), the spine text centre within ±0.5 px of the spine centre at 20 and 120 pages, a long spine text ellipsised, the chip absent on A3 landscape, the inspector sub and hint texts
- **Musts:** kit and prod are one design (Spec "Layers", "Spine text", "Inspector"); mini covers keep no overlays
- **Hard nos:** no changes under `src/**` or `e2e/` (items 1 and 3); no manual spine control (D7)
- **Test:** kit `qa:quick` checks (DOM measurements); no prod e2e
- **UI kit:** `uikit#/feature/cover-editor`
- **Source:** Designer Spec `cover-editor` (orch `shared/design/cover-editor/spec.md`), "Kit changes", "Geometry", "Layers", "Spine text", "Inspector"
