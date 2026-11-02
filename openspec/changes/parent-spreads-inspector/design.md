## Decisions

1. Core grid chain book → `spreadParent` grid → spread; source `'master'`; `resolveLayoutGrid` cache keys on the parent grid. `spreadParent` moves to `src/core/spreadParent.ts` (no import cycle); `resolveParentGrid` stays the PBT oracle.
2. `GridOverlay` resolves ids via `editableSpread` and snapshots the cached `resolveLayoutGrid` pages, so only spreads using an edited master re-render. `variant="master"` (via `ConnectedSpreadView` `gridVariant`, only from `MastersCanvas`) ignores the Grid toggle and uses new tokens `--grid-master-line` / `--grid-master-fill` (`docs/design.md`).
3. Masters tab routing: frame on the shown parent → Photo view (sections look frames up via `editableSpread`); else `MasterSection`; no parents → hint. Empty pointerdown on the master stage clears the frame.
4. `MasterSection` reuses `InspectorHead`, `InspectorSec`, `.insp-size-field`, react-aria `NumberField`, `Icon` (+ `link2` / `unlink2`).

## Touch-set & Test Plan

| Path                                                 | Why                      |
| ---------------------------------------------------- | ------------------------ |
| `src/core/grid/layoutGrid.ts`                        | chain, source, cache     |
| `src/core/spreadParent.ts`                           | helper                   |
| `src/core/parentSpreads.ts`                          | re-export                |
| `src/editor/GridOverlay.tsx`                         | snapshot, variant        |
| `src/editor/ConnectedSpreadView.tsx`                 | prop                     |
| `src/editor/MastersCanvas.tsx`                       | overlay, label, deselect |
| `src/editor/CoverCanvas.css`                         | label                    |
| `src/editor/editorChromeTokens.ts`                   | master grid tokens       |
| `docs/design.md`                                     | tokens                   |
| `src/editor/Inspector.tsx`                           | routing                  |
| `src/editor/MasterSection.tsx`                       | MS1–MS4                  |
| `src/editor/InspectorControls.css`                   | focus ring               |
| `src/editor/inspectorModel.ts`                       | `parentUsage`            |
| `src/editor/GridSection.tsx`                         | source type              |
| `src/editor/PhotoSection.tsx`                        | parent frames            |
| `src/editor/FitCropSection.tsx`                      | parent frames            |
| `src/editor/PhotoRotateSection.tsx`                  | parent frames            |
| `src/editor/PhotoFrameSections.tsx`                  | parent frames            |
| `src/ui/icons/glyphs.ts`                             | glyphs                   |
| `uikit/src/sandbox/v7.tsx`                           | kit sync                 |
| `e2e/parent-spreads-inspector.spec.ts`               | new e2e + gate           |
| `e2e/parent-spreads-edit.spec.ts`                    | hint → head              |
| `docs/roadmap/P2/parent-spreads-inspector.md`        | scope narrowed           |
| `docs/roadmap/P2/parent-spreads-inspector-guides.md` | MS10                     |

- Unit: layoutGrid (master source, cache, PBT ≥1000), MasterSection, parentUsage, Inspector, GridOverlay, GridSection.
- e2e: browser check, None spread, MS2 rects, MS7, no-masters hint, no page scroll, 40-spread gate.
