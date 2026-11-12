## Implementation

- [ ] 1. `shelf.ts` + tests: kit port on `ShelfBook`.
- [ ] 2. `siteSystem.css` + opsz fonts + preload: tokens, type, case, Book3D CSS, Site Inter Display.
- [ ] 3. `Book3D.tsx` + `book3dGl.ts`: CSS book, lazy GL after load + idle, D38 input, `?gl=0` / no WebGL2 keep CSS.
- [ ] 4. `SiteHome.tsx` (replaces `SiteCatalog.tsx`) + `SiteApp.tsx`: name, lead (D37), case, links, empty state, laid flag.
- [ ] 5. `renderSitePage.tsx` / `sampleShell.ts`: theme-color, bars, noscript; drop catalog helpers; update unit tests + snapshot.
- [ ] 6. e2e: `site-final.spec.ts` (checkpoints at 1440×900, 1920×1080, 390×844, font, links, no shift, `?gl=0`, empty state, hover perf); old home selectors in existing specs.

## Manual test scenarios

1. `/site.html` at 1440×900: the name, the lead and the bookcase; hover a face-out and a spine (lift), click → the book page.
2. `/site.html` at 390×844: phone layout, no horizontal scroll; tap a book opens it.
3. `/site.html?gl=0`: CSS books only.
