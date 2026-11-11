## Implementation

- [x] 1. Route `#/guide[/<id>]`, KitBar "Guide" link, document title. Evidence: guide-qa "document title", "KitBar Guide link is current"; qa:quick 429/429.
- [x] 2. `imposition.ts` `saddleSheets` + `Imposition.tsx` panel (Segmented, sheets, assembly, notes). Evidence: guide-qa saddleSheets(20) / (22), Pages 22 summary + 6 sheets, assembly top 12003.22 → 12003.22.
- [x] 3. `content.ts`: 18 chapters (copy verified against kit + prod), parts, `CHAPTER_OF`, `NOT_IN_APP`, shortcuts. Evidence: guide-qa 23/23 slugs mapped, 93 links resolve.
- [x] 4. `GuidePage.tsx`: TOC (sticky, IntersectionObserver current, click scroll), hero + journey, chapters (wide / two / stack), feature index, credits footer. Evidence: guide-qa TOC 16 at y 72.48, masters deep link at 72.08, no overflow at 1280.
- [x] 5. `capture()` `dpr` option; `guide-shots.mjs`; `public/guide/*.jpg` + `shots.json` (≤ 3 MB). Evidence: 17 JPEGs, 2892 KB.
- [x] 6. `guide-qa.mjs` checks + `qa.mjs` `#/guide` whitelist; `#/demo` before/after capture identical. Evidence: guide-qa 19/19; demo:baseline main vs branch pixelmatch 0/80 changed.

## Manual test scenarios

1. Open `#/guide` at 1440 × 900: hero, 18 chapters with screenshots and markers, feature index.
2. Click TOC "Print at home and bind": the chapter lands under the bar and the link is current; URL is `#/guide/print-home`.
3. In chapter 16 pick 22: the summary reads "22 pages + 2 blank → 6 sheets", the assembly row does not move.
4. Open `#/guide/masters` directly: the page opens scrolled to chapter 11.

Results (kit-only page: `pnpm agent manual-qa` drives the prod editor, so scenarios ran as headless Chrome via `guide:qa` on the built kit, 1440 × 900):

- OK 1 — 18 sections, one h1, 17 images loaded, 93 links resolve, feature index 23/23, no console errors.
- OK 2 — `#print-home` top 72.48, link `aria-current="location"` (only one), hash `#/guide/print-home`.
- OK 3 — "22 pages + 2 blank → 6 sheets, printed on both sides", sheet 1 front-left paints blank, assembly top 12003.22 → 12003.22.
- OK 4 — `#masters` top 72.08 and current.
