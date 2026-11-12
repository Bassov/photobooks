## Implementation

- [x] 1. `shelf.ts` + tests: kit port on `ShelfBook`.
- [x] 2. `siteSystem.css` + opsz fonts + preload: tokens, type, case, Book3D CSS, Site Inter Display.
- [x] 3. `Book3D.tsx` + `book3dGl.ts`: CSS book, lazy GL after load + idle, D38 input, `?gl=0` / no WebGL2 keep CSS.
- [x] 4. `SiteHome.tsx` (replaces `SiteCatalog.tsx`) + `SiteApp.tsx`: name, lead (D37), case, links, empty state, laid flag.
- [x] 5. `renderSitePage.tsx` / `sampleShell.ts`: theme-color, bars, noscript; drop catalog helpers; update unit tests + snapshot.
- [x] 6. e2e: `site-final.spec.ts` (checkpoints at 1440×900, 1920×1080, 390×844, font, links, no shift, `?gl=0`, empty state, hover perf); old home selectors in existing specs.

## Manual test scenarios

1. `/site.html` at 1440×900: the name, the lead and the bookcase; hover a face-out and a spine (lift), click → the book page.
2. `/site.html` at 390×844: phone layout, no horizontal scroll; tap a book opens it.
3. `/site.html?gl=0`: CSS books only.

manual-qa (stage 9): problem (harness) — all three stop at the editor welcome screen (`start-session` click intercepted by its header) before reaching `/site.html`; no site scenario ran. Covered instead by `e2e/site-final.spec.ts`: checkpoints at 1440×900 / 1920×1080 / 390×844 (no horizontal scroll), links + paint probe + click opens Sea, hover frame-budget gate, `?gl=0` CSS-only, no shift across the GL handoff. ui-review (Playwright): Tab reaches Alps → Sea → Lake with a 2 px solid focus ring and `Title, year, pages` labels; reduced motion sets the lift transition to 0 s.
