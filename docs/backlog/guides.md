# guides

Tag: feature
Milestone: backlog (held 2026-10-30; target P2)
Title: guides

## Scope

- [ ] Editor overlay layer above `SpreadView` (editor-only, never in output); guides are its first content
- [ ] Drag from a ruler to create a guide; move, delete
- [ ] Show / hide guides, snap on / off (view state)
- **Perf:** guide drag is a `transform` in rAF, committed at gesture end.
- **Browser check:** pull guides from both rulers, move and delete one, zoom — guides stay aligned with rulers; guides never appear in presentation mode.
- **Kit-first:** yes. Held in `docs/backlog/` (Designer call B1, 2026-10-30) until its kit page lands; then the Owner re-adds it with `pnpm roadmap add <slug> --after <X>` and the Reviewer fills in Kit components / Demo / Musts.
- **Kit components:** none, **kit-first**: Designer adds the kit page (`guides`) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** none yet (kit-first)
- **Musts:** drag guides from rulers
- **Hard nos:** no guide UI before the kit page
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** rulers
- **UI kit:** none (no matching component); kit-first
