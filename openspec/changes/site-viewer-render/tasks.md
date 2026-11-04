## Implementation

- [x] 1. Move `BookObject`, `bookObjectLayout` (+ tests) to `src/render/`; update LibraryEmpty, BookTile, libraryBookFilter. Evidence: `src/render/BookObject.test.tsx`, `src/render/bookObjectLayout.test.ts`, e2e `library-screens.spec.ts`.
- [x] 2. Move `pageLabel` to `src/core/pages.ts` (+ tests); update SpreadsPanel, inspectorModel; drop editor re-exports. Evidence: `src/core/pages.test.ts` `pageLabel`.
- [x] 3. `SpreadView` `imageFor` + `FrameImage`, unit test (srcset rendered; absent prop = unchanged DOM). Evidence: `src/render/SpreadView.imageFor.test.tsx`.
- [x] 4. Move `coverLayout` (+ test) and `CoverCanvas.css` → `CoverView.css` to `src/render/` (CoverSection, MastersCanvas imports); extract `CoverView` + unit test. Evidence: `src/render/CoverView.test.tsx`, `src/render/coverLayout.test.ts`.
- [x] 5. `CoverCanvas` and Preview `PresentationCover` paint through `CoverView`. Evidence: `src/editor/CoverCanvas.test.tsx`, `CoverParity.test.tsx`, e2e `presentation-mode.spec.ts`, `kit10-cover.spec.ts`, `cover-hires.spec.ts`.

## Manual test scenarios

1. Editor: cover canvas, spread-list cover row, Preview cover slide and library tiles look as before (no visual baseline change).
   - problem (harness, not product): `pnpm agent manual-qa` timed out on `start-session` click (welcome header intercepts pointer events). Evidence instead: e2e `kit10-cover`, `cover-hires`, `design-filmstrip-cover`, `design-r2-cover-book`, `design-inspector-book-cover`, `presentation-mode`, `preview-no-overlays`, `library-screens`, `specimen-forms` (screenshots), `spread-view`: 57 passed, no baseline change.
