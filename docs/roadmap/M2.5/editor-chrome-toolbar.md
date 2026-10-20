# editor-chrome-toolbar

Tag: feature
Milestone: M2.5
Title: editor bars on primitives

## Scope

- [ ] Top bar, `CameraBar` and `SpreadTemplateBar` rebuilt from Toolbar, Button, IconButton and SegmentedControl; tooltips show shortcuts; one primary action per view
- [ ] Update e2e selectors via accessible names; refresh baselines
- **Perf:** zoom indicator keeps its narrow subscription; tooltips mount lazily. Gate: `camera-zoom-pan` zoom scenario and a template switch — zero LoAF.
- **Browser check:** every bar action works by mouse and keyboard with a visible focus ring; tooltips show shortcuts; bars wrap without page-level H/V scroll at 320 px and 4K.
- **UI ref:** `uikit#/feature/editor-chrome-toolbar`
- **UI kit:** `uikit/src/features/m25.tsx:212-221` (`editor-chrome-toolbar` demo + notes), `UI ref: uikit#/feature/editor-chrome-toolbar` — top bar, CameraBar, templates from Toolbar primitives, `uikit/src/components/ui/toolbar.tsx`, `uikit/src/components/ui/button.tsx`, `uikit/src/components/ui/toggle.tsx`, `uikit/src/components/ui/tooltip.tsx`
