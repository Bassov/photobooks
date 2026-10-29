# page-numbers

Tag: feature
Milestone: P2
Title: page numbers

## Scope

- [ ] Page-number item on parents (from `parent-spreads-schema`), derived from the spread's pages (left / right, start number, skip first, format)
- **Browser check:** page numbers appear on every page, follow reordering, and skip the first page.
- **Kit-first:** yes. Not buildable until the kit page exists (Designer). `roadmap next` does NOT skip it automatically: pass `--skip <slug>` (or the Owner holds it) until the kit page lands.
- **Kit components:** none, **kit-first**: Designer adds the kit page (`page-numbers`) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** none yet (kit-first)
- **Musts:** page numbers on spreads
- **Hard nos:** no page-number UI before the kit page
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** text-frame-model, parent-spreads
- **UI kit:** none (no matching component); kit-first
