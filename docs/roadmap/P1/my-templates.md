# my-templates

Tag: feature
Milestone: P1
Title: My templates: save a spread as a layout, rename / duplicate / delete (kit LayoutSection)

## Scope

- [ ] "Save as template" (`+` in the Layout header and the full-width button) stores the spread's photo frames as a custom layout; the "My templates N" tab lists them; the "All" count includes them.
- [ ] Tile menu: Rename…, Duplicate, Delete (kit `TemplateTile` custom menu).
- **Browser check:** save a spread as a template, find it under My templates, rename, duplicate and delete it, apply it to another spread.
- **Perf:** no extra thumbnail work on unrelated commits.
- **UI kit:** `uikit/src/sandbox/context-inspector.tsx` (`LayoutSection` save, `TemplateTile` menu), `uikit/src/sandbox/templates.ts` (custom store); UI ref: `uikit#/demo`.
- **Source:** design-r2-layout-picker (2026-10-31): the `+` ships disabled until this lands.
