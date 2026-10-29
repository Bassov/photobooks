# arrange-lock

Tag: feature
Milestone: P2
Title: stacking and locking

## Scope

- [ ] Delta only (z-order and lock already ship in the inspector, `FrameSections.tsx`): context menu + shortcuts for z-order / lock; a locked frame ignores drag and drop
- **Perf:** a z-order change re-renders only its spread.
- **Browser check:** send a frame behind another and lock it; a locked frame ignores drag and drop.
- **Kit components:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); `ArrangeSection` + lock button in `GeometrySection` (`uikit/src/sandbox/inspector.tsx`)
- **Demo:** `uikit#/demo` steps 16 `editor-frame-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** context menu and shortcuts call the same ops as the inspector
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-inspector-frame-spread
- **UI kit:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); `ArrangeSection` + lock button in `GeometrySection` (`uikit/src/sandbox/inspector.tsx`)
