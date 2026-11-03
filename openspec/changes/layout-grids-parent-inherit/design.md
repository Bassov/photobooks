## Decisions

1. Shared `src/editor/GridFields.tsx` (field + grid + link, lifted from MasterSection); optional source props turn on GP2/GP3, without them the master renders as today.
2. Source styling keyed on `data-source` on the field box; source text in `title` + `aria-describedby`.
3. ↺ dispatches `resetSpreadGridFields` (four margins when linked); existing `rotateCcw` glyph, no new icon.
4. `customFor` keeps Custom after the last ↺; link state keyed by spread id; link-on writes only margins ≠ T.
5. Dead book grid section and kit `GridSection` are deleted (GP9: a third grid look; roadmap hard-no on dead controls).
6. Kit mirrors 1–4 in `v7.tsx` / `context-inspector.tsx`. Tokens `--field`, `--muted-foreground`, `--t-text`; none new.

## Touch-set & Test Plan

| Path                                      | Why                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `src/editor/GridFields.tsx`               | new shared field + grid + link                                         |
| `src/editor/MasterSection.tsx`            | uses GridFields                                                        |
| `src/editor/GridSection.tsx`              | Custom with sources / ↺ / hint; dead book section removed              |
| `src/editor/GridSection.css`              | `.grid-field*` / `.grid-eye` out; `data-source`, `.insp-grid-reset` in |
| `src/editor/Inspector.tsx`                | passes only `spreadId`                                                 |
| `src/editor/GridSection.test.tsx`         | GP2/GP3/GP4/GP5 units                                                  |
| `src/editor/GridFields.test.tsx`          | shared field units (master vs spread)                                  |
| `src/editor/inspectorModel.ts`            | `marginsEqual`, `linkMarginsPatch`, `resetGridFields`                  |
| `src/editor/inspectorModel.test.ts`       | units for those helpers                                                |
| `e2e/kit10-grid-snap.spec.ts`             | new field names                                                        |
| `uikit/scripts/qa.mjs`                    | kit smoke for GP2/GP3                                                  |
| `e2e/layout-grids-parent-inherit.spec.ts` | GP1 rects vs kit, roadmap browser check                                |
| `e2e/layout-grids-settings.spec.ts`       | new test ids                                                           |
| `e2e/design-r2-layout-picker.spec.ts`     | new test ids                                                           |
| `uikit/src/sandbox/v7.tsx`                | kit Field / GridFields source + ↺                                      |
| `uikit/src/sandbox/context-inspector.tsx` | kit SpreadGridSection per-key Custom, hint                             |
| `uikit/src/sandbox/sections.tsx`          | dead kit GridSection out                                               |

- Reuse: `effectiveGrid`, `masterGridPatch`, `resetSpreadGridFields`, `resetSpreadGrid`, `Icon`.
- Tests: unit GP2–GP5; e2e `?fixture=painter&parent=a` covers empty / happy / interact and GP1 rects; MasterSection tests and GP8 unchanged; PBT already in `layoutGrid.test.ts`. Skill `ui-review` before push.
