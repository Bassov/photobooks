# kit2-undo-history

Tag: feature
Milestone: backlog (held 2026-10-30; target P2)
Title: undo history list (kit-first)

## Scope

- [ ] A history list / panel over the shipped labelled undo / redo (`src/editor/bookHistory.ts`, M3 `document-history`, #222): see past steps by label and jump back. Undo / redo buttons and shortcuts are not in scope; their restyle is P1 `kit10-editor-chrome`.
- **Perf:** set when the kit page lands
- **Browser check:** set when the kit page lands
- **Kit-first:** yes. Held in `docs/backlog/` (Designer call B1, 2026-10-30): the kit has labelled undo / redo (`uikit/src/sandbox/chrome.tsx:96` `HistoryButtons`, `uikit/src/sandbox/store.tsx` `Hist`) but **no history list** (v0.9.3 `document-history` page removed). Owner re-adds it with `pnpm roadmap add` once Designer adds a history list (for example a popover on `HistoryButtons`).
- **Kit components:** none for the list (absent in `uikit/src/sandbox`); kit-first
- **Demo:** none yet (kit-first)
- **Musts:** Designer defines
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** set when the kit page lands
- **Depends:** kit10-editor-chrome
- **UI kit:** none (no matching component); kit-first
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
