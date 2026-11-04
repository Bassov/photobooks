# page-numbers-core

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item page-numbers-core
Status: done

## Scope

- [ ] New pure module `src/core/pageNumbers.ts` (+ exports in `src/core/index.ts`): `pageNumberItems(book, parentId, position)`, `pageNumberPosition(parent)`, `formatPageNumber(n, format)` (decimal / lower / upper roman), `folioText(book, page)` (n = start + page − 1; none on page 1 when skipFirst, on missing page sides, or for ids in `hiddenIds`)
- [ ] Items `${parentId}-pn-l` / `-pn-r`, rect from the Designer spec table (Outer / Centre / Inner), position read back from the left item's align; no schema change
- [ ] Ops `setParentPageNumbers {parentId, position|null}` and `setPageNumbering {patch}` wired in `applyBookOp.ts` with undo labels; rects re-derived after grid edits that reach a parent and after trim changes (every caller listed in the PR)
- [ ] `ResolvedSpread.folios?: {id, text, rectMm, align}[]` filled by `resolveSpread.ts` (structural cache keyed on spread index, `pageNumbering`, the parent's `pageNumbers`, hiddenIds)
- **Done when:** unit + PBT (≥1000 runs) for `pageNumbers.ts`: roman round trip 1–999, reorder renumbers, skipFirst, hidden ids, rect inside safe for margins 0–40; op tests incl. undo; A5 / 15 mm geometry (Outer / Centre / Inner, y 200.33) asserted in mm; existing resolver and parent-spreads tests green unchanged
- **Browser check:** n/a (no UI; canvas, inspector and Book settings follow in `page-numbers`)
- **Design SoT:** Designer design `page-numbers` spec l.18-42, Prod changes Core l.75-76, Tests l.81+ (READY 2026-11-04)
- **Hard nos:** no UI; no `uikit/`, `src/render/` or `src/editor/` UI files; add-only in `resolveSpread.ts` / `types.ts` / `index.ts`
- **Test:** unit + PBT on the pure module, op tests via `applyBookOp`, bookStore undo test
- **Depends:** parent-spreads-schema, parent-overrides-core
