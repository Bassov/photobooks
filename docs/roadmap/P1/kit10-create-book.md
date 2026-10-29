# kit10-create-book

Tag: feature
Milestone: P1
Title: Create book dialog: kit v0.10 look (title, page size, custom size)

## Scope

- [ ] Create dialog with title, size menu and custom size as in kit v0.10.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/spread-templates-ui` (`uikit/src/features/pages.tsx` page `spread-templates-ui`); parts: `uikit/src/features/create-book.tsx` (`CreateBookDialog`)
- **Demo:** `uikit#/demo` steps 05 `create-book-dialog`, 06 `create-book-size-menu`, 07 `create-book-custom-size` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** centered dialog with dim; Cancel + Create visible; custom size in cm with the kit field look
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll; no new page sizes beyond what the product supports (unsupported kit sizes hidden)
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 05–07, signed off by Designer review
- **Depends:** kit10-library-books
- **UI kit:** `uikit#/feature/spread-templates-ui` (`uikit/src/features/pages.tsx` page `spread-templates-ui`); parts: `uikit/src/features/create-book.tsx` (`CreateBookDialog`)
