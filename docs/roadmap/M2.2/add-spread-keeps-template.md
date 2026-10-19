# add-spread-keeps-template

Tag: feature
Milestone: M2.2
Title: Add spread uses the active spread's template, and the template control says it is per spread

## Scope

- [ ] OpenSpec delta `editor-shell`, Requirement "Active spread template and add spread" (`openspec/specs/editor-shell/spec.md:108-120`): the appended spread MUST use the template of the spread that was active when Add spread was pressed (one-per-page when none is active). Scenario "Add spread enters the pasteboard" (`:117-120`) changes to match. The template control's accessible name says it applies to the active spread (for example "Template for this spread")
- [ ] Op: `addSpread` (`src/core/ops/spreads.ts:6-22`) takes an optional `templateId` (validated with `isTemplateId`, default `'one-per-page'` at `:20`). `BookOp` `addSpread` (`src/core/ops/applyBookOp.ts:36,63-71`) carries it. Other callers stay on the default: `bookStore.ts:72` (session book) and `projectSession.ts:703`
- [ ] UI: `Pasteboard.tsx` `onAddSpread` (`:311-320`) dispatches `{ type: 'addSpread', templateId: getSpreadTemplateId(markedId) }` (`markedId` `:281`, passed to the bar at `:379-380`). `SpreadTemplateBar.tsx:32` radiogroup `aria-label` updated; after the reveal the radio shows the new spread's template, which is now the copied one
- [ ] Tests: `src/core/ops/ops.test.ts:178-211` gains cases for `templateId` (4-grid copied, invalid id falls back, first/last single-page roles still reapplied by `reapplyChangedPageRoles` `spreads.ts:24-44`); fast-check property: `addSpread` with any valid template keeps `invariants.ts`; `Pasteboard.view.test.tsx` add-spread cases
- [ ] e2e regression (`e2e/template-unplace.spec.ts` or `spread-view.spec.ts`): fresh book, choose 4-grid, Add spread. The new spread has four frame placeholders and the radio still shows 4-grid; scroll back to spread 1 and it shows 4-grid. The existing reveal/containment assertions (`assertDocumentFitsViewport`) still pass
- **Done when:** (1) the e2e regression test above fails on main (radio snaps to One per page, one frame per page) and passes on the branch; (2) the spec delta is archived and `openspec validate` passes; (3) the unit and property tests above pass; (4) patch coverage ≥ 85%, Stryker diff ≥ 85 with zero NoCoverage, and no gate weakened or newly excluded
- **Perf:** no new work per frame; Add spread keeps the existing reveal and frame-budget scenarios green (`e2e/spread-view.spec.ts` add-spread zoom/LoAF cases).
- **Browser check:** on the preview URL, choose 4-grid and press Add spread. The new spread comes into view as a 4-grid, the radio still shows 4-grid, and the control's label makes clear it sets this spread's template. Repeat with 2-up and Full bleed. The committed zoom is kept and there is no page scroll.
- **Size:** ~200–300 changed lines (spec delta + op option + Pasteboard/TemplateBar + tests)
- **Source:** #40
