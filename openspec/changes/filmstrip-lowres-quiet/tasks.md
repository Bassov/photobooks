## Implementation

- [x] 1. Shared `isAssetLowRes` + memoized `countLowResAssets` in `src/editor/pageFillLowRes.ts` (`FilmstripSortFilter.test.tsx` "Photos header low-res count (P11)").
- [x] 2. Prod chip always icon-only 18 × 16.84 (`FilmstripItem.tsx`, `Filmstrip.css`; `design-r16-prod.spec.ts` M85, `Filmstrip.test.tsx`).
- [x] 3. Prod header " · N low-res" in warning ink, filtered and unfiltered (`FilmstripDock.tsx`; unit + `design-r16-prod.spec.ts`).
- [x] 4. Kit chip + `film-head` count (`uikit/src/sandbox/chrome.tsx`; `e2e/kit-filmstrip-lowres.spec.ts`).
- [x] 5. Pins: `printer-presets.spec.ts` (accessible name), `design-filmstrip-fixed.spec.ts` (no thumb text).

## Manual test scenarios

1. Prod 1440×900: import a folder with a small photo and a 24 MP photo; the small thumb shows an 18 × 16.84 warning icon chip with no text; header ends "· 1 low-res" in warning ink.
2. Drag the dock edge to max height: the chip stays 18 × 16.84, still no text.
3. Turn on "Unplaced", place the low-res photo: the header loses "low-res".
