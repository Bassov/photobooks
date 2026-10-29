# rulers

Tag: feature
Milestone: P2
Title: mm rulers

## Scope

- [ ] mm rulers following the camera
- **Perf:** rulers drawn on a `<canvas>` per camera frame. Gate: pan / zoom with rulers visible — zero LoAF.
- **Browser check:** pan and zoom; ruler ticks stay aligned with the spread.
- **Kit-first:** yes. Not buildable until the kit page exists (Designer); `roadmap next` must skip it until then.
- **Kit components:** none, **kit-first**: Designer adds the kit page (`rulers`) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** none yet (kit-first)
- **Musts:** mm rulers follow the camera
- **Hard nos:** no ruler UI before the kit page
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-canvas
- **UI kit:** none (no matching component); kit-first
