## Implementation

- [x] 1. `rulersMath` pure tick math + unit tests (`rulersMath.test.ts`)
- [x] 2. `rulersView` visibility store (default off) + tests
- [x] 3. `Rulers` canvas component (ticks, labels, spine, cursor tick, corner "mm") + `Rulers.test.tsx`
- [x] 4. Pasteboard stage wrapper + 22 px inset
- [x] 5. Top-bar `RulersToggle` and `Shift+R` key + tests
- [x] 6. e2e `rulers.spec.ts`

## Manual test scenarios

1. Toggle rulers; scroll and zoom; ticks stay on the spread edges, X label resets to 0 at the spine, cursor tick follows the pointer.
