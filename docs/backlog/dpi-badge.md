# dpi-badge

Tag: feature
Milestone: backlog (held 2026-10-30; target P2)
Title: resolution while you lay out

## Scope

- [ ] Badge on frames below the profile's warn / min DPI (book-editor defaults when no profile is chosen) on the editor overlay layer (editor-only, never in output)
- **Perf:** DPI computed inside the memoized resolve per spread; one badge element per low frame; recomputed only for changed spreads. Gate: crop-zoom pan across the threshold — zero LoAF.
- **Browser check:** zoom a low-DPI photo inside its frame — the badge appears at the book-editor default threshold (warn 200 / min 150 dpi until `print-profiles`) and clears when zoomed out; badges never appear in Preview or output.
- **Kit-first:** yes. Held in `docs/backlog/` (Designer call B1, 2026-10-30) until its kit page lands; then the Owner re-adds it with `pnpm roadmap add <slug> --after <X>` and the Reviewer fills in Kit components / Demo / Musts.
- **Kit components:** partial: Low-res chip on filmstrip thumbnails (`uikit/src/sandbox/chrome.tsx` `Filmstrip`, visible in `#/demo` 11–12); frame badge kit-first: Designer adds it before the frame part can be built
- **Demo:** none yet (kit-first; Low-res chip in sandbox only)
- **Musts:** low-resolution warning on frames
- **Hard nos:** no warning UI before the kit page
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-canvas
- **UI kit:** partial: Low-res chip (`uikit/src/sandbox/chrome.tsx` `Filmstrip`); frame badge kit-first
