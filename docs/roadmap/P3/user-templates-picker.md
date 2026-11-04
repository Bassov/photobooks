# user-templates-picker

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item user-templates-picker
Status: done

## Scope

- [ ] The Layout picker offers only own templates saved on the current page shape (`pages` = page count of the selected spread; All / My templates counts follow the filter; thumbnails on the current trim; single-page empty state "No templates yet. Save a page you like."); Save never duplicates (same `pages`, slot count and every slot within 0.5 pp → nothing added, My templates / Any, the existing tile flashes 1200 ms and scrolls into view); `setEditorStatus` announcements for save / rename / duplicate / delete / duplicate-save / failed library write; rename `maxLength` 60; the kit picker does the same (custom templates no longer through `pageFrames`, Save disabled without image frames, tile menu hidden at rest) plus demo step `editor-page1-my-templates` (Designer spec `user-templates` UT1 picker, UT2, UT3, UT4)
- **Done when:** `e2e/design-r2-layout-picker.spec.ts` updated per the Designer spec (kit seed counts on spread 2–3) plus: page 1 shows My templates 0 with "Save a page you like."; a template saved on page 1 shows on page 1 and the last page, not on spread 2–3; saving twice keeps one template and sets the tile's `data-flash`; `src/editor/LayoutSection.saved.test.tsx` updated; kit qa green
- **Kit components:** `uikit/src/sandbox/templates.ts`, `uikit/src/sandbox/context-inspector.tsx` (`LayoutThumb`, `TemplateTile`, `LayoutSection` only)
- **Demo:** new step `editor-page1-my-templates` after `editor-spread-selected` (baseline regenerated)
- **Musts:** see Scope
- **Hard nos:** no best-fit change (`src/core/templates/best.ts`, `multiDrop.ts`, `galleryDrop.ts` are `user-templates-best-fit`); in `context-inspector.tsx` / `demo-capture.mjs` edit only the layout functions and add the one step without reordering others
- **Test:** unit + e2e + kit qa
- **Browser check:** page 1 → My templates 0 + "Save a page you like."; save on page 1 → listed on page 1 and the last page, not on spread 2–3; Save twice → one template, tile flashes
