# frame-styles

Tag: feature
Milestone: P2
Title: consistent frames across the book

## Scope

- [ ] Create / edit / apply frame styles from the inspector; editing a style updates every frame using it
- [ ] Spread background color
- **Perf:** a style edit re-renders only spreads that use it; strokes and mats are borders / insets, no blurred shadows. Gate: edit a style used on 40 spreads — zero LoAF.
- **Browser check:** give all photos a white 5 mm mat via one style, change it to 3 mm — every spread updates; set a dark spread background.
- **Kit components:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); `FrameStyleSection`, `SpreadBgSection` (`uikit/src/sandbox/sections.tsx`)
- **Demo:** `uikit#/demo` steps 16 `editor-frame-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** book-level frame styles
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** book-styles-schema
- **UI kit:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); `FrameStyleSection`, `SpreadBgSection` (`uikit/src/sandbox/sections.tsx`)
