## Implementation

- [ ] 1. `layoutCatalog.ts`: `sortByPhotoCount`, `marginVariant`, `PICKER_MERGES` + `mergeLayouts` (aliases); unit tests incl. every builtin pair.
- [ ] 2. `Disclosure` `note` prop (always-visible muted header note); unit test.
- [ ] 3. `LayoutSection`: one sorted list, no search, no Suggested split, merged builtins, alias pressed state, header note, builtin tiles without captions (`title` + `aria-label`); unit tests updated.
- [ ] 4. New e2e `layout-picker-simplify.spec.ts` incl. legacy `two-portraits` book fixture; update the existing e2e listed in design.

## Manual test scenarios

1. Spread 2–3: list starts with 1-photo layouts, no captions, hover shows the name tooltip, header `LAYOUT · <name>`; Photos 2 and My templates filters.
