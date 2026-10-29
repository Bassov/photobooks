# kit10-stage5-pixel-fixes

Tag: feature
Milestone: P1
Title: Kit stage-5 pixel fixes in product (Low-res chip gray, contrast, >=20 pages)

## Scope

- [ ] After Designer ships the stage-5 fixes in the kit, port them to product: gray Low-res chip, contrast fixes, layout with 20+ pages.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit-first:** yes. Not buildable until the kit page exists (Designer). `roadmap next` does NOT skip it automatically: pass `--skip <slug>` (or the Owner holds it) until the kit page lands.
- **Kit components:** none, **kit-first**: Designer adds the kit page fixes (kit v0.10.x stage-5 backlog) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** kit-first: steps named by the kit fix
- **Musts:** match the fixed kit pages
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for the fixed kit steps, signed off by Designer review
- **Depends:** kit10-spread-list, kit10-inspector
- **UI kit:** none (no matching component); kit-first
