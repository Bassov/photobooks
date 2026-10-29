# kit2-spread-menu

Tag: feature
Milestone: P2
Title: spread reorder and spread menu (kit-first)

## Scope

- [ ] Reorder spreads and a spread context menu in the spread list (v0.9.3 `spread-reorder-retemplate` removed in v0.10).
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit-first:** yes. Not buildable until the kit page exists (Designer); `roadmap next` must skip it until then.
- **Kit components:** none, **kit-first**: Designer adds the kit page (replaces removed v0.9.3 `spread-reorder-retemplate`) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** none yet (kit-first)
- **Musts:** Designer defines
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-editor-chrome
- **UI kit:** none (no matching component); kit-first
