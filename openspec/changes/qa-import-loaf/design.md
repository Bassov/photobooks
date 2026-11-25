## Decisions

1. Profile first (Playwright, OPFS folder through the real `showDirectoryPicker` path, LoAF script attribution, CDP CPU profile, React commit probe). Long frames attribute to the `bookStore` gallery flush (`FrameRequestCallback` → `flushPendingGalleryAndMeta`, 30–150 ms blocking). Each 4-id chunk publishes a new `book`, and the Layout inspector (`SpreadSections`, `LayoutSection`, `GridSection`, `MasterSection`) plus `LayoutCycle` subscribe to the whole book, so all of them re-render per chunk. No 24 MP decode or header read runs on the main thread (worker + 64 KB head pass).
2. Fix: `getLayoutBookSnapshot()` in `bookStore` keeps its identity while only `gallery` / `assets` change; those five readers use it. Helpers they call (`effectiveGrid`, `spreadParent`, `parentChanges`, `inspectorModel`, `layoutCycleOf`, `pickerSaved`, `getSpreadSizeMm`) read neither field. Folder add, file add and drop import all publish through the same flush, so all three get the fix.
3. The click frame (React discrete render of the picker-busy state, 10–30 ms at 4× throttle) stays: under the 20 ms noise bucket at the CI 2× rate.

## Touch-set & Test Plan

| File                                          | Why                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/editor/bookStore.ts`                     | `getLayoutBookSnapshot`                                                                    |
| `src/editor/SpreadSections.tsx`               | layout snapshot                                                                            |
| `src/editor/LayoutSection.tsx`                | layout snapshot                                                                            |
| `src/editor/GridSection.tsx`                  | layout snapshot                                                                            |
| `src/editor/MasterSection.tsx`                | layout snapshot                                                                            |
| `src/editor/LayoutCycle.tsx`                  | layout snapshot                                                                            |
| `src/editor/bookStore.layoutSnapshot.test.ts` | unit: identity kept on import, follows layout ops                                          |
| `e2e/import-folder-loaf.spec.ts`              | functional: 0 inspector renders during import; perf: app-attributed LoAF at `PERF_BUDGETS` |
