## Implementation

- [x] 1. Room Share + Fullscreen (desktop group, phone rows, lightbox, key API) in `room.tsx` / `room.css`
- [x] 2. `SysSite` / `PersonalSite`: `books`, `start`, `roomRef`; `SiteBook.pages`, safe `src`; an edit to the open book keeps its room open (only a new set of book ids closes it); the home name is `aria-current="page"`
- [x] 3. `siteBooks.ts` adapter (D38) + Node unit test
- [x] 4. `DemoSite` / `DemoSitePreview` on the bookcase / room; kit page notes
- [x] 5. `demo-capture.mjs` site steps; kit qa smokes moved to the room
- [x] 6. e2e: D36 geometry / Copied / lightbox paint; `#/demo` titles; the two kit Preview specs on the room

## Manual test scenarios

1. Kit `#/full/personal-site?book=lake-trip` 1440×900: foot right group Share · Fullscreen · Play; Share → Copied 2 s; Fullscreen → lightbox, double-click zooms, Esc closes, focus back on Fullscreen.
2. 390×844: Share left of Play in the header, no Fullscreen.
3. Kit `#/demo` Publish → Open site: bookcase of the published book; click it → room.
4. Kit `#/feature/site-viewer` with nothing published (empty): the open book alone on the case.

manual-qa: harness problem — blocked at the prod welcome `start-session` click (header intercepts), kit routes unreachable; no product failure.
Covered instead: 1–2 `e2e/kit-personal-site-share.spec.ts` + uikit qa (site-viewer smoke, focus rings, D36 Copied); 3 `e2e/kit-personal-site-demo.spec.ts` + uikit qa #/demo walk + demo baselines 60–63; 4 `e2e/kit-personal-site-demo.spec.ts` (nothing published) + uikit qa.
