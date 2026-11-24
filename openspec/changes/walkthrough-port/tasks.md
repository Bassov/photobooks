## Implementation

- [x] 1. Route `#/guide[/<chapter>]`, `href.guide`, `main.tsx` dispatch + title (418ffff3; e2e `kit home: the Walkthrough nav item…`)
- [x] 2. KitBar "Walkthrough" nav item (`data-nav="guide"`, no href) (418ffff3; e2e nav click + keyboard tests; `uikit:qa:quick` 63/63)
- [x] 3. Guide modules on main's tokens (GuidePage, Rich, Imposition, imposition copy) (418ffff3; e2e `the guide imposition copy equals prod imposition()`)
- [x] 4. Chapter copy updated to main: direct crop, filmstrip resize, copy / paste / duplicate, frame context menu + photo pick, placed badge, Fill book, layout cycle, interface size, cover PDF; changed labels and keys (418ffff3, `content.ts`)
- [x] 5. `guide-shots.mjs` on the unchanged `demo-capture.mjs`; `guide:shots` script; figures + `shots.json` recaptured (418ffff3; 20 shots at DPR 2, 2423 KB, two runs byte-equal in size)
- [x] 6. `e2e/kit-guide.spec.ts` (6 passed; `e2e/kit e2e/design-r e2e/cover-stage e2e/a5-fit` 671 passed)

## Manual test scenarios

1. Kit home → "Walkthrough" in the top bar → `#/guide` opens with the TOC; the item is current.
2. Click TOC "Print at home and bind" → chapter 16 under the bar; 4-up → sheets change, the "Cut across" step un-dims.
3. Scroll the whole guide: every figure shows; "Kit page: …" links open existing pages.

Results: `pnpm agent manual-qa` drives the prod editor shell and cannot open kit routes, so the scenarios ran as Playwright walks in `e2e/kit-guide.spec.ts` on the built kit (`/uikit/`).

- 1 OK: the nav item is painted on top (`elementFromPoint`) and opens `#/guide` by click and by Enter, with `aria-current=page` and 22 TOC links.
- 2 OK: the TOC click lands `#print-home` at 72 px with `aria-current=location`; 2-up 5 sheets → 4-up 3 sheets; `data-skip` goes 1 → 0.
- 3 OK: 20 figures decoded, painted (not one flat colour) and on top; every `#/…` link resolves; 22 feature links open without not-found.
