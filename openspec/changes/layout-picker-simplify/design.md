## Decisions

1. **Order.** `layoutCatalog.ts` `sortByPhotoCount(items)`: stable sort by slot count (kit order inside a count, saved after builtins of that count). One grid for both tabs; Suggested / All layouts and search go.
2. **Merge by geometry.** `marginVariant(a, b)`: same rect count, every rect inside the trim, and each `a` rect a centred inset of the matching `b` rect keeping ≥ 70% of its area (only margins differ). `PICKER_MERGES = [['two-portraits', 'one-per-page']]`; `mergeLayouts(items)` drops the first id where the rule holds on that spread (two-page spreads; on one-page spreads Two portraits has 2 slots vs 1 and stays). A unit test runs the rule over every builtin pair (A5, square; one- and two-page spreads) and fails if any other pair matches; the PR lists the numbers.
3. **Alias, no rewrite.** `two-portraits` stays in `TEMPLATE_IDS`, `generateTemplateFrames` and `templateName`, so load, render, regrid, auto-fill, preview and export resolve it as before. `mergeLayouts` returns `aliases`; the picker presses `aliases[current] ?? current` and names the header after it (also for auto-filled Two portraits spreads).
4. **Header note.** `summary` stays collapsed-only and right-aligned (other sections rely on it); a new optional `Disclosure` `note` renders ` · <name>` right after the eyebrow while expanded or collapsed, in the summary's type (`--text-xs`, `--muted-foreground`). The trigger's accessible name stays "Layout".
5. **Captions.** Builtin tiles: no `tpl-name`, `title` = name, `aria-label` = `Apply layout <name>`. Saved tiles keep captions.

## Touch-set & Test Plan

- Files: `src/editor/LayoutSection.tsx|.css`, `src/editor/layoutCatalog.ts`, `src/ui/Disclosure.tsx|.css`, their tests; new e2e `layout-picker-simplify.spec.ts`; updated e2e `design-r2-layout-picker`, `design-r2-inspector`, `design-r7-panels`, `design-r10-chrome`, `inspector-spread-book`, plus any of `autosave`, `spread-reorder`, `drag-place`, `spread-view`, `template-slot-aspects` that pick Two portraits on a two-page spread.
- Tests: unit — sort, merge pairs, alias, Disclosure note; e2e — order, filters, empty My templates, tooltips, header, inspector-only scroll, legacy `two-portraits` OPFS book with stored rects. Skill `ui-review` before push.
