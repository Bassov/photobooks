# site-preview-mode-kit

Tag: feature
Milestone: P3
Title: kit Preview opens the site book page (Designer site-preview-mode item 1)
Status: done

## Scope

Item 1 of the Designer `site-preview-mode` spec (2026-11-05): the kit Preview opens the site's book page of the current book (`DemoSitePreview`) instead of presentation mode. Kit only (`uikit/`); `src/**` and `uikit/src/**/canvas.tsx` are off limits.

- [x] `uikit/src/features/site-viewer.tsx`: `share` prop (default on); `single` drops the All books row from the stage height.
- [x] `uikit/src/demo-parts/site.tsx`: `DemoSitePreview` (48 px bar #E1E1E1, "‹ Back to the editor" exactly on the Library link, "Site preview" label, `.site` scroll box; All books + Share hidden; Fullscreen = site lightbox).
- [x] `uikit/src/demo-parts/editor.tsx`: Preview renders `DemoSitePreview` over the still-mounted editor; delete `uikit/src/demo-parts/presentation.tsx`.
- [x] `uikit/src/features/pages.tsx` `site-preview-mode`: states preview, spread, fullscreen + notes.
- [x] `uikit/scripts/qa.mjs`: KS14 presentation checks → site-preview checks; demo step `editor-preview` comment + re-baseline.
- **Browser check:** `#/demo` editor → Preview: the site book page under a 48 px bar, Back on the Library link; → steps; Delete does nothing; Fullscreen → Esc closes it, Esc again returns to the unchanged editor with focus on Preview.

## Done when

- `DemoSitePreview` matches the spec values at 1440×900 (stage 760 × 460 at x 340, y 218.84; Back x 12 y 8 h 32) and 1280×720 (stage 676 × 409.15), ±0.5 px.
- Esc order: Fullscreen open → first Esc closes it, second closes the preview; while open no key reaches the editor (Delete, ⌘Z, arrows change nothing); Tab trapped; focus back on the Preview pill.
- Kit page states + kit qa checks green.
