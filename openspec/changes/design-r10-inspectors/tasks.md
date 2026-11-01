## Implementation

- [ ] 1. Shared kit `InspectorHead` / `InspectorSec` / `InspectorRow` with kit line-heights; Cover and Book settings rendered through them (M59).
- [ ] 2. Book settings Page size select 32 px and `SegmentedControl` size `inspector` (kit `SegC`) for Portrait/Landscape and cm/mm (M59, M61).
- [ ] 3. Segmented labels 500 in both states (shared class, editor chrome), layout tabs 13 / 500 (M61).
- [ ] 4. Photo inspector: collapsible PHOTO / Fit & crop / Rotate & flip sections open by default, kit inner padding, kit slider rows, muted Quarter turn note, 37 px closed-section pitch (M60).
- [ ] 5. Unit tests for the primitives, segmented size, Disclosure crop-keep / closed padding and the photo sections; Owner design change edits in `FrameSections.test.tsx` and `e2e/design-r9-letter-spacing.spec.ts` (M60).
- [ ] 6. `e2e/design-r10-inspectors.spec.ts`: kit positions and type for M59–M61 at 1440 × 900, M48 rows and M57 type still exact.

## Manual test scenarios

1. Select the cover, then the book title: head, section titles and rows sit at the kit rhythm; selects unchanged.
2. Select a filled frame: PHOTO, FIT & CROP, ROTATE & FLIP open with ▾ chevrons; collapse PHOTO and reopen it; crop mode survives a Fit & crop header click.
3. Book settings / layout picker / Create dialog segmented labels read 13 px medium in both states.
