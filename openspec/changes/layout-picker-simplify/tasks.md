## Implementation

- [x] 1. `layoutCatalog.ts`: `sortByPhotoCount`, `marginVariant`, `PICKER_MERGES` + `mergeLayouts` (aliases); unit tests incl. every builtin pair.
- [x] 2. `Disclosure` `note` prop (always-visible muted header note); unit test.
- [x] 3. `LayoutSection`: one sorted list, no search, no Suggested split, merged builtins, alias pressed state, header note, builtin tiles without captions (`title` + `aria-label`); unit tests updated.
- [x] 4. New e2e `layout-picker-simplify.spec.ts` incl. legacy `two-portraits` book fixture; update the existing e2e listed in design.

## Manual test scenarios

1. Spread 2–3: list starts with 1-photo layouts, no captions, hover shows the name tooltip, header `LAYOUT · <name>`; Photos 2 and My templates filters.
   - problem (harness, not product): `pnpm agent manual-qa` timed out on `start-session` (the welcome header intercepts the 1px button) and never reached spread 2–3. The scenario is covered by `e2e/layout-picker-simplify.spec.ts:52` (10/10 with `--repeat-each`). A Playwright run of the real app produced `docs/evidence/layout-picker-simplify/inspector-layout-panel.png`.
