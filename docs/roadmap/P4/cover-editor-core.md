# cover-editor-core

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item cover-editor-core
Status: done

## Scope

Item 1 of the Designer `cover-editor` Spec (2026-11-05): the print geometry of the cover sheet, core only. Items `cover-editor-kit` and `cover-editor` (prod) build on it.

- [ ] `src/core/print/profileSchema.ts`: profile fields `coverWrapMm` / `coverHingeMm`; the generic profile is wrap 15 mm, hinge 8 mm and spine formula 8 + 0.2 mm/page (Spec D1, D2)
- [ ] Zod-free `src/core/print/genericProfile.ts` (generic profile + default id, exported by `src/core/index.ts`) so `printProfile.ts` and the geometry stay out of the zod / site bundle
- [ ] Zod-free `src/core/print/coverGeometry.ts`: `spineWidthMm(rule, pages, pageCount)` (formula `round1(base + perPage × pages)`, table first row with `maxPages ≥ pages` else last row, pages clamped to the profile range) and `bookCoverGeometry(book)` (sheet = (2·trim w + spine + 2·wrap) × (trim h + 2·wrap); cover / back / spine / front / hinge / safe rects in sheet mm; unknown profile → generic)
- [ ] `src/core/pages.ts`: `bookSpineWidthMm` delegates to the geometry; `SPINE_BOARD_MM` / `SPINE_MM_PER_PAGE` / `spineWidthForPages` removed (20 pages → 12 mm unchanged)
- [ ] Manual spine source in core only (Spec D7): `cover.print.spineWidthSource: 'manual'` uses `cover.style.spineWidthMm` when the profile allows `manualOverride`; no UI
- [ ] `src/core/cover.ts` `clearRemovedCoverAssets` keeps `cover.print`
- **Kit components:** none (core only, no UI)
- **Demo:** n/a (core only)
- **Browser check:** none: no UI change; the drawn spine stays 12 mm at 20 pages (generic 8 + 0.2 mm/page)
- **Done when:** unit + PBT for `spineWidthMm` (clamp at both page-range ends, generic 20 → 12 mm, 120 → 32 mm, table past the last row) and `bookCoverGeometry` (19 × 23 cm, 20 pages: sheet 422 × 260 mm, spine 12, wrap 15, hinge 8; sheet = 2·trim + spine + 2·wrap exactly); `clearRemovedCoverAssets` keeps `cover.print` (regression test); `pages.test.ts`, `profileSchema.pbt.test.ts`, `printProfile.test.ts` updated
- **Musts:** profile is the single source of the spine width; geometry modules import no zod
- **Hard nos:** no UI; no changes under `uikit/`, `src/render/`, `src/editor/`, `src/site/`, `e2e/`
- **Test:** unit + PBT on the pure modules; no e2e (no UI); no perf scenario (no interaction)
- **UI kit:** none (no matching component)
- **Source:** Designer Spec `cover-editor` (orch `shared/design/cover-editor/spec.md`), "Designer decisions" D1, D2, D7, "Geometry", "Prod changes" core lines, "Tests"
