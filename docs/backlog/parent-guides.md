# parent-guides

Tag: feature
Milestone: backlog (held 2026-10-30; target P2)
Title: guides on parent spreads

## Scope

- [ ] Guides created, moved or typed in while editing a parent belong to the parent; they appear on every spread using it (styled as inherited, not draggable there) and feed `snapping-engine`
- [ ] Spread guides are added on top of parent guides; show / hide guides and snap on / off cover both
- **Perf:** a parent guide drag is a `transform` in rAF on the parent view, committed at gesture end; only spreads using that parent re-render. Gate: drag a guide on a parent used by 40 spreads — zero LoAF.
- **Browser check:** add two guides on a parent — they appear on every spread using it and frames snap to them; add a spread-only guide — it shows on that spread alone.
- **Kit-first:** yes. Held in `docs/backlog/` (Designer call B1, 2026-10-30) until its kit page lands; then the Owner re-adds it with `pnpm roadmap add <slug> --after <X>` and the Reviewer fills in Kit components / Demo / Musts.
- **Kit components:** none, **kit-first**: Designer adds the kit page (`parent-guides`) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** none yet (kit-first)
- **Musts:** guides on masters
- **Hard nos:** no UI before the kit page
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** guides, parent-spreads
- **UI kit:** none (no matching component); kit-first
