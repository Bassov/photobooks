## Decisions

1. Root cause: `CoverCanvas` reads `useCoverPhotoUrl` (filmstrip `thumbCache` only), so no tier is ever requested or swapped for the cover. `BookTile` reads only the `thumb` preset from DerivedCache.
2. Move the per-asset loop of `ConnectedSpreadView`'s tier effect (`setSpreadTiers` → `subscribeTier` → `requestTier` → `queueCachedLadderTiers`, cleanup) into `holdDisplayTiers(slotId, tiers)` (new `holdDisplayTiers.ts`; `spreadPreviewKeys.ts` stays pure). Spread view and cover both call it.
3. `useTierPreviewUrl(assetId, slotId?)` holds `{assetId → selectImageTier()}` under `slotId`, returns `getDisplayedPreview` ?? thumb. `CoverCanvas` gets optional `tierSlot`: `CoverOverlay` `cover:canvas`, Preview `cover:preview`; the spreads-panel row passes none. `useCoverPhotoUrl` stays for inspector / endpaper.
4. `useCachedThumbUrl` → `useCachedCoverUrl`: `tier-1280`, then `thumb`. No new blob-URL lifecycle (same create/revoke). No new tokens or primitives; no scrollport.

## Touch-set & Test Plan

| File                                 | Why                        |
| ------------------------------------ | -------------------------- |
| `src/editor/holdDisplayTiers.ts`     | shared tier hold           |
| `src/editor/ConnectedSpreadView.tsx` | use it                     |
| `src/editor/useTierPreviewUrl.ts`    | cover hook                 |
| `src/editor/CoverCanvas.tsx`         | `tierSlot`                 |
| `src/editor/CoverOverlay.tsx`        | slot                       |
| `src/editor/PresentationMode.tsx`    | slot                       |
| `src/editor/useCachedCoverUrl.ts`    | was `useCachedThumbUrl.ts` |
| `src/editor/BookTile.tsx`            | tile cover                 |
| `e2e/cover-hires.spec.ts`            | Done when                  |

- Tests (renamed alongside): `CoverCanvas.test.tsx` (canvas swaps to 1280, row stays thumb, release on unmount, empty front plain), `useCachedCoverUrl.test.tsx` (tier first, thumb fallback); e2e cover vs page-frame natural width and library tile.
