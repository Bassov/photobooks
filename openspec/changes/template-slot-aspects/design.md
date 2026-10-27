## Decisions

1. `TemplateId = FixedTemplateId | contact-${cols}x${rows}`; `TEMPLATE_IDS` stays the fixed tuple (+ `two-portraits`, `landscape-two-portraits`); `isTemplateId` also accepts contact ids (cols 1..5, rows 1..4). Contact sheet = cols×rows per page in each page's margin-inset box (column/row gutters), page by page, row-major.
2. `slotAspect(rect)`: square when |w/h−1| ≤ 0.05, else portrait/landscape; `templateSlotAspects(id, book, idx, spread?)` is the metadata.
3. Portrait templates place a centered 3:4 (landscape 3:2) frame fitted in a cell. `two-portraits`: 2-page → one per page box; 1-page → two columns split by the column gutter. `landscape-two-portraits`: 2-page → landscape in left page box, two portraits side by side in right page box; 1-page → landscape in top half, two portraits side by side in bottom half.
4. `photoAspectClass(widthPx, heightPx, exifOrientation)` (5–8 swap axes). `bestTemplateId(book, idx, photos[])` is pure: candidates = specific fixed templates first, generic after, then smallest contact sheet holding the photos (max 5×4); rank by class mismatches (square matches any), then empty slots, then candidate order; none → `one-per-page`.
5. Bar (primitives: `SegmentedControl` sm; `pb-button--secondary pb-button--sm`; native `input[type=number]` with `--input`/`--border`/`--ring`): contact-sheet spread shows no segment selected and Columns/Rows prefilled from the id; inputs clamp to 1..5 / 1..4, Apply disabled while empty/invalid. Apply uses the existing `applyTemplate` op.

## Touch-set & Test Plan

- Files: `src/core/templates/{types,catalog,aspect,best}.ts`, `src/core/index.ts`, `src/core/testing/bookModel.ts` (contact ids in PBT pool), `src/editor/SpreadTemplateBar.tsx`, `src/editor/EditorShell.css`, `e2e/template-slot-aspects.spec.ts`, `openspec/specs/layout-geometry/spec.md`.
- Reuse: `contentBox`, `updateSpread`, `rebindFrames`.
- Tests: unit (geometry, aspects, best, ids); PBT: contact frames inside margin box, non-overlapping, count = cols·rows·pages; bar component test (contact selected state, clamp, invalid); e2e (empty disabled, 2-portrait + 3×4, switch back keeps order); skill `ui-review` on the bar.
