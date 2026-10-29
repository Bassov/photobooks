# arrange-lock

Tag: feature
Milestone: P2
Title: stacking and locking

## Scope

- [ ] Z-order (bring forward / backward / to front / to back) and lock in the inspector, context menu and shortcuts
- **Perf:** a z-order change re-renders only its spread.
- **Browser check:** send a frame behind another and lock it; a locked frame ignores drag and drop.
- **Kit components:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); partial: Arrange / lock section exists in sandbox only; Designer confirms it on the inspector page
- **Demo:** `uikit#/demo` steps 16 `editor-frame-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** stacking and lock from the inspector Frame section
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** inspector
- **UI kit:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); partial: Arrange / lock section exists in sandbox only; Designer confirms it on the inspector page
