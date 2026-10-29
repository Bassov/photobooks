# guides-precise

Tag: feature
Milestone: backlog (held 2026-10-30; target P2)
Title: exact guides

## Scope

- [ ] Numeric entry; lock; book-level vs spread guides
- **Browser check:** place a guide at an exact mm value, lock it, switch it between book and spread scope — it stays put while dragging nearby.
- **Kit-first:** yes. Held in `docs/backlog/` (Designer call B1, 2026-10-30) until its kit page lands; then the Owner re-adds it with `pnpm roadmap add <slug> --after <X>` and the Reviewer fills in Kit components / Demo / Musts.
- **Kit components:** none, **kit-first**: Designer adds the kit page (`guides-precise`) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** none yet (kit-first)
- **Musts:** numeric guide positions
- **Hard nos:** no guide UI before the kit page
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** guides
- **UI kit:** none (no matching component); kit-first
