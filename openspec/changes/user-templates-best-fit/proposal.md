## Proposal

Roadmap: `docs/roadmap/P3/user-templates-best-fit.md` (scope / Done when / Browser). Designer spec `user-templates` UT6.

### Scope out

- Picker UI (`src/editor/LayoutSection.*`, `user-templates-picker`) and `uikit/`.
- Saved-template storage (`libraryDocument` / `savedTemplates` internals, merged in `user-templates-store`).
- Frame drop (`fillSpread`): it keeps the spread's layout, so best fit never runs there.

### Delta / Risk

- `bestTemplateId` returns `string` (a custom `user-…` id can win); the gap-drop op carries the saved list, so `src/core` stays free of editor state.
