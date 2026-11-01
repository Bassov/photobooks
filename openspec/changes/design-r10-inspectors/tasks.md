## Implementation

- [x] 1. Shared kit `InspectorHead` / `InspectorSec` / `InspectorRow` with kit line-heights; Cover and Book settings rendered through them (M59).
- [x] 2. Book settings Page size select 32 px and `SegmentedControl` size `inspector` (kit `SegC`) for Portrait/Landscape and cm/mm (M59, M61).
- [x] 3. Segmented labels 500 in both states (shared class, editor chrome), layout tabs 13 / 500 (M61).
- [x] 4. Photo inspector: collapsible PHOTO / Fit & crop / Rotate & flip sections open by default, kit inner padding, kit slider rows, muted Quarter turn note, 37 px closed-section pitch (M60).
- [x] 5. Unit tests for the primitives, segmented size, Disclosure crop-keep / closed padding and the photo sections; Owner design change edits in `e2e/design-r9-letter-spacing.spec.ts` (PHOTO title) and `e2e/design-r2-inspector.spec.ts` (Rotate & flip heading on the disclosure) (M60). `FrameSections.test.tsx` needed no change.
- [x] 6. `e2e/design-r10-inspectors.spec.ts`: kit positions and type for M59–M61 at 1440 × 900, M48 rows and M57 type still exact.

## Manual test scenarios

1. Select the cover, then the book title: head, section titles and rows sit at the kit rhythm; selects unchanged.
2. Select a filled frame: PHOTO, FIT & CROP, ROTATE & FLIP open with ▾ chevrons; collapse PHOTO and reopen it; crop mode survives a Fit & crop header click.
3. Book settings / layout picker / Create dialog segmented labels read 13 px medium in both states.
