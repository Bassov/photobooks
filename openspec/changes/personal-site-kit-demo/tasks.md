## Implementation

- [ ] 1. Room Share + Fullscreen (desktop group, phone rows, lightbox, key API) in `room.tsx` / `room.css`
- [ ] 2. `SysSite` / `PersonalSite`: `books`, `start`, `roomRef`; `SiteBook.pages`, safe `src`
- [ ] 3. `siteBooks.ts` adapter (D38) + Node unit test
- [ ] 4. `DemoSite` / `DemoSitePreview` on the bookcase / room; kit page notes
- [ ] 5. `demo-capture.mjs` site steps; kit qa smokes moved to the room
- [ ] 6. e2e: D36 geometry / Copied / lightbox paint; `#/demo` titles; the two kit Preview specs on the room

## Manual test scenarios

1. Kit `#/full/personal-site?book=lake-trip` 1440×900: foot right group Share · Fullscreen · Play; Share → Copied 2 s; Fullscreen → lightbox, double-click zooms, Esc closes, focus back on Fullscreen.
2. 390×844: Share left of Play in the header, no Fullscreen.
3. Kit `#/demo` Publish → Open site: bookcase of the published book; click it → room.
4. Kit `#/feature/site-viewer` with nothing published (empty): the open book alone on the case.
