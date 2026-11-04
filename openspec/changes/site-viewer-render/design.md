## Decisions

1. `src/render/` never imports `src/editor/`: `BookObject`, `bookObjectLayout`, `coverLayout` (+ tests) and `CoverCanvas.css` → `CoverView.css` move unchanged. No shims.
2. `pageLabel` → `src/core/pages.ts` + barrel; editor re-exports go.
3. `SpreadView` `imageFor?: (assetId, share) => FrameImage | undefined` (`share` = frame / spread width; `FrameImage = { src, srcset, sizes, loading? }`) sets the frame `<img>` attributes; otherwise `previewUrlFor` (today's DOM).
4. `CoverView({ book, frontUrl, frontTier, widthPx, edit })`, no store / tiers: no `edit` = mini cover; `edit` adds editor chrome. CSS-background front: one url.
5. `CoverCanvas` wraps `CoverView` with store + tier hook + drop; Preview renders `CoverView` directly.

## Touch-set & Test Plan

| Path                               | Why         |
| ---------------------------------- | ----------- |
| `src/render/BookObject.tsx`        | moved       |
| `src/render/bookObjectLayout.ts`   | moved       |
| `src/render/coverLayout.ts`        | moved       |
| `src/render/CoverView.css`         | moved       |
| `src/render/CoverView.tsx`         | new         |
| `src/render/SpreadView.tsx`        | `imageFor`  |
| `src/render/spreadMissing.ts`      | generic     |
| `src/core/pages.ts`                | `pageLabel` |
| `src/core/index.ts`                | barrel      |
| `src/editor/CoverCanvas.tsx`       | CoverView   |
| `src/editor/PresentationMode.tsx`  | CoverView   |
| `src/editor/editorChromePanels.ts` | import      |
| `src/editor/editorChromeTokens.ts` | import      |
| `src/editor/LibraryEmpty.tsx`      | import      |
| `src/editor/BookTile.tsx`          | import      |
| `src/editor/libraryBookFilter.ts`  | import      |
| `src/editor/SpreadsPanel.tsx`      | import      |
| `src/editor/inspectorModel.ts`     | import      |
| `src/editor/CoverSection.tsx`      | import      |
| `src/editor/MastersCanvas.tsx`     | import      |

- Reuse: `frameBox`, `previewUrlUnlessMissing`.
- Unit: `imageFor` srcset; absent prop = identical `outerHTML`; CoverView mini / `widthPx` / `edit`. Existing tests and baselines pin the DOM.
