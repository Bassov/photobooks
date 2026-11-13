## Implementation

- [x] 1. M106: the `pt-gl` canvas shows (`visibility: visible`) once GL drew; unit in `turn.test.tsx` ("shows the canvas at rest once it has drawn").
- [x] 2. M107: no cover turn on open in portrait (mode read at timer time); unit in `SiteRoom.test.tsx` ("portrait over the home: opens at the cover").
- [x] 3. M110: desk room name is a link home through `closeClick`, over the GL canvas; unit in `SiteRoom.test.tsx` ("names the site with a link home").
- [x] 4. e2e `e2e/site-room-parity.spec.ts`: M106 paint at 390×844 (GL on and `gl=0`), M107 390 tap → "Cover", M110 1440 name → home in one history step; M106/M107 fail with the fixes reverted.

## Manual test scenarios

1. 390×844: tap a home book → "Cover", the cover photo painted; turn to page 1, page 2 — photos painted.
2. 1440×900: open a book, click the site name → home; browser Forward reopens the book.

- problem (harness): `pnpm agent manual-qa` timed out on the editor welcome `start-session` click (header intercepts pointer events) before reaching `/site.html`; both scenarios are locked by `e2e/site-room-parity.spec.ts` (5/5 pass locally, M106/M107 fail with the fixes reverted).
- ui-review: OK — name link has an accessible name, `.ss :where(a)` focus-visible outline, same look, on top of the GL canvas (`topAt`); paint checked in Playwright.
