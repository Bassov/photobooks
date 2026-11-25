## Implementation

- [x] 1. Profile the QA-4 folder import and attribute the long frames (design 1).
- [x] 2. `getLayoutBookSnapshot` in `bookStore` + unit test (`bookStore.layoutSnapshot.test.ts`).
- [x] 3. Layout inspector sections and `LayoutCycle` read the layout snapshot.
- [x] 4. e2e `import-folder-loaf.spec.ts`: functional inspector-render check + frame-budget LoAF gate.

## Manual test scenarios

1. New book → Photos dock **Add folder…** → the QA-4 folder (10 kit photos, `large-24mp.jpg`, 3 small fixtures): thumbnails fill in, the Layout inspector stays put, no LoAF ≥ 20 ms attributed to app scripts.
   - OK (no UI change; driven by `e2e/import-folder-loaf.spec.ts` through the real `showDirectoryPicker` path: 0 inspector renders, 5/5 gate runs at 2× with no blocking frame).
