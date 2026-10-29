# kit2-undo-history

Tag: feature
Milestone: backlog (held 2026-10-30; target P2)
Title: undo history UI (kit-first)

## Scope

- [ ] Restyle the shipped undo / redo history (`bookHistory.ts`, M3 `document-history`) to the new kit page (behavior already ships; no re-implementation).
- **Perf:** set when the kit page lands
- **Browser check:** set when the kit page lands
- **Kit-first:** yes. Held in `docs/backlog/` (Designer call B1, 2026-10-30) until its kit page lands; then the Owner re-adds it with `pnpm roadmap add <slug> --after <X>` and the Reviewer fills in Kit components / Demo / Musts.
- **Kit components:** none, **kit-first**: Designer adds the kit page (replaces removed v0.9.3 `document-history`) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** none yet (kit-first)
- **Musts:** Designer defines
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** set when the kit page lands
- **Depends:** none (behavior shipped)
- **UI kit:** none (no matching component); kit-first
