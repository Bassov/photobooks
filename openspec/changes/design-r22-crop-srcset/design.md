## Decisions

1. Drawn width = the `<img>` box width, which is what srcset `w` descriptors compare against: `rect.width / crop.width` unturned (`imageCropBox`), `rect.height / crop.width` for odd quarter turns (`turnedPhotoStyle` lays the image out in source orientation). A pure `drawnWidthMm(item)` in `src/render/frameBox.ts` beside `imageCropBox`; a missing or zero crop width falls back to 1, as there.
2. `SpreadView` passes `drawnWidthMm(item)` to `imageFor`; the prop doc says "drawn width". `SiteStage` is unchanged (its share = widthMm / stage mm), so stage and lightbox `sizes` both grow by the crop scale. No other `imageFor` caller exists (`git grep imageFor`); the editor preview paints through `renderSlide` without srcset.
3. Test data: `sampleSite.ts` gains a `crop` book (one portrait page, landscape photo, default fill crop) reachable by `?book=crop` only, not in the catalog.

## Touch-set & Test Plan

| File                                                  | Why                                              |
| ----------------------------------------------------- | ------------------------------------------------ |
| `src/render/frameBox.ts`                              | `drawnWidthMm`                                   |
| `src/render/frameBox.test.ts`                         | unit: unturned, odd turn, zero crop              |
| `src/render/SpreadView.tsx`                           | pass drawn width                                 |
| `src/render/SpreadView.imageFor.test.tsx`             | landscape photo in portrait frame → drawn width  |
| `src/site/SiteBookPage.test.tsx`                      | sizes follow the 1400 × 933 photo's hair of crop |
| `src/site/__snapshots__/renderSitePage.test.tsx.snap` | same `sizes` change in export HTML               |
| `src/site/sampleSite.ts`                              | unlisted `crop` book                             |
| `e2e/site-crop-srcset.spec.ts`                        | DPR 1: page 1 `currentSrc` width ≥ painted px    |
| `e2e/site-viewer.spec.ts`                             | single-page `sizes` share 0.42 → 0.4202          |

- Reuse: `imageCropBox` fallback rule, `resolveSpread` fill crop, the srcset override trick from `e2e/site-lightbox.spec.ts`.
- e2e offers 480/960/1600/2400 w of the same bytes and checks the picked width ≥ the img's `getBoundingClientRect().width`, plus a paint check that the image covers the frame.
