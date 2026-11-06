# design-r19-cover-dots

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item design-r19-cover-dots
Status: done

## Scope

Designer parity `cover-editor` (2026-11-06 04:08), Must M95, fix in prod. `.cover-stage` (`src/render/CoverView.css`) sits over the workspace at z-index 30 and paints a flat `var(--canvas)`, so the cover, endpaper and masters canvases hide the pasteboard dot grid the kit shows (pixels beside the cover 229–230 in the kit, flat 198–200 in prod). Spread steps already match. Predates #513.

- [ ] `.cover-stage` takes the `.editor-workspace` pasteboard background (`src/editor/EditorShell.css`: `var(--canvas)` + `radial-gradient(circle, var(--dot) 1px, transparent 1.4px)`, 16 px pitch at 8 px offset) from one shared rule; the flat `background: var(--canvas)` goes; the stage stays opaque
- [ ] Every `.cover-stage` caller (cover, endpaper, masters) listed in the PR body as fixed or left out with a reason
- **Kit components:** none (kit is already right)
- **Demo:** n/a (prod only)
- **Browser check:** at 1440×900 the pasteboard beside the cover, endpaper and masters sheets shows the dot grid at the spread workspace pitch and phase; no spread shows through the stage
- **Done when:** paint check on the cover, endpaper and masters canvases at 1440×900: the pasteboard beside the sheet has dot pixels ≥ 225 (not a flat 198–200), 16 px pitch aligned with the spread workspace (no jump spread ↔ cover); the stage is opaque (spreads under it do not show through); sheet geometry unchanged (D3: sheet 848×522.45 at y 136.77)
- **Musts:** one shared background definition, no copy
- **Hard nos:** no `uikit/` edits; no edits to `uikit/scripts/qa.mjs`, `uikit/src/kit/pages.json`, `uikit/src/features/pages.tsx`, `docs/design.md`; no backward compat
- **Test:** e2e paint probe (clipped screenshot pixels) on the three stages + the spread workspace; unit CSS assertion on the shared rule; no perf scenario (static paint)
- **UI kit:** kit viewport pasteboard (already right)
- **Source:** Designer review `cover-editor` (orch `shared/design/cover-editor/p/review.md`, probe `p/dots.mjs`, shots `p/out/{kit,prod}-editor-cover-selected.png`)
