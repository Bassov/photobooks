## Implementation

- [ ] 1. Data: `entry` on the book page input (`buildSiteTree`, sample site, `previewEntry`); `siteModel` view labels, room meta, phone slides with labels; stage sizing dropped.
- [ ] 2. `src/site/book/{reader,slides,turn}.tsx` + `room.css` + lazy `roomGl.ts`: kit port with `SpreadView` CSS faces and painted GL faces.
- [ ] 3. `SiteRoom.tsx`: layouts (desk / narrow / portrait / landscape), foot row, Play, swipe back, Share (D36), Fullscreen → `SiteLightbox` (spreads only); delete `SiteBookPage` / `SiteStage`.
- [ ] 4. `SiteApp` / `startSite`: room over the home, `book.json` prefetch + load, history (Back / Esc / All books), direct book URL, `#pN`.
- [ ] 5. Prerender + CSS: book page room at the server box, theme colour, `site.css` / `siteViewer.css` dropped; editor preview swapped to `SiteRoom`.
- [ ] 6. Unit tests: `SiteRoom`, `SiteApp`, `ShareButton`, `siteModel`, `startSite`, `roomGl`, `renderSitePage`.
- [ ] 7. e2e: `site-final.spec.ts` room checkpoints, history, `#p4`, no-WebGL CSS reader; `site-reader-gl.spec.ts`; old selectors moved in `site-viewer`, `site-lightbox`, `site-preview-mode`, `static-export*`, `site-crop-srcset`.

## Manual test scenarios

1. `/site.html` at 1440×900: click a book → the room fades in and the cover turns; Next / Previous turn; Share reads "Copied" then "Share"; Fullscreen opens the lightbox, Esc returns to the same spread; Back returns to the home.
2. `/site.html?book=alps#p4` at 390×844: page turn opens on page 4; a tap on the right half turns.
