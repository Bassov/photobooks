## Decisions

1. `SpreadView` paints `resolved.folios` as `.spread-view-folio` in `.spread-view-parent-layer` after the parent frames (layer mounts when either exists); `thumb` paints none. Look per `docs/design.md` Folios; `data-testid="page-number"`.
2. `MastersCanvas` adds a `#` chip per `parent.pageNumbers` item over the master spread (kit v7 `chip`), token in `docs/design.md` Folios.
3. `MasterSection` "Page numbers" after Grid: Show → `setParentPageNumbers` `outer` / `null`; when on, position seg and hint with a "Book settings" button (top-bar title steps).
4. `Inspector` shows Book settings in Masters mode while selected; master pick and tab switch clear it.
5. `BookSettingsSection` "Page numbers" between Binding and Print: `StartAtField` (`PagesField` pattern; the op clamps / ignores NaN), format seg, Skip first toggle, note. Copy in pure `pageNumberCopy` (`inspectorModel.ts`).

## Touch-set & Test Plan

| File                                          | Reason                                           |
| --------------------------------------------- | ------------------------------------------------ |
| `src/render/SpreadView.tsx`                   | folios                                           |
| `src/render/SpreadView.css`                   | folio style                                      |
| `src/render/SpreadView.parent.test.tsx`       | under frames, none in thumbs                     |
| `src/editor/MastersCanvas.tsx`                | chips                                            |
| `src/render/CoverView.css`                    | chip style (masters canvas CSS)                  |
| `src/editor/MasterSection.tsx`                | section                                          |
| `src/editor/MasterSection.test.tsx`           | section tests                                    |
| `src/editor/BookSettingsSection.tsx`          | section                                          |
| `src/editor/inspectorModel.ts`                | copy helper                                      |
| `src/editor/inspectorModel.test.ts`           | copy tests                                       |
| `src/editor/Inspector.tsx`                    | Book settings in Masters mode                    |
| `src/editor/MastersPanel.tsx`                 | pick clears Book settings                        |
| `src/editor/LeftPanel.tsx`                    | tab switch clears Book settings                  |
| `src/editor/LayoutSection.test.tsx`           | pinned section list                              |
| `src/editor/BookSettingsPageNumbers.test.tsx` | section tests                                    |
| `e2e/design-r9-letter-spacing.spec.ts`        | pinned section list                              |
| `e2e/design-r10-inspectors.spec.ts`           | pinned y +179.37                                 |
| `e2e/page-numbers.spec.ts`                    | feature e2e                                      |
| `e2e/page-numbers-perf.spec.ts`               | 0 LoAF                                           |
| `docs/design.md`                              | chip token                                       |
| `src/editor/bookStore.ts`                     | repaint on `pageNumbers` / `pageNumbering` edits |
| `src/editor/bookStore.test.ts`                | repaint scope                                    |
| `src/editor/InspectorControls.css`            | Book settings link                               |
| `src/editor/Inspector.test.tsx`               | Masters-mode Book settings                       |
| `src/editor/LeftPanel.test.tsx`               | tab / pick clear Book settings                   |
| `src/editor/MastersCanvas.test.tsx`           | chips                                            |
| `src/editor/BookSettingsKit.test.tsx`         | pinned section list                              |

- Reuse: core ops / `spreadFolios`, `InspectorSec`, `InspectorRow`, `ToggleSwitch`, `SegmentedControl`, `.insp-pages-field`, `SUB` / `FIELD` / `T`.
- e2e `?fixture=painter&parent=a`: positions ±0.5 px, Fit font, zoom, reorder, skip, roman, chips. Perf: Master A on 40 spreads, reorder → 0 LoAF. `ui-review` on both sections.
