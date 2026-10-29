# live-captions

Tag: feature
Milestone: P2
Title: captions from photo metadata

## Scope

- [ ] Caption anchored to a photo frame; template tokens `{date}`, `{title}`, `{caption}`, `{camera}`; updates when the photo is replaced; "Make static"
- **Perf:** captions re-resolve only for frames whose asset changed. Gate: swap photos across a spread with live captions — zero LoAF.
- **Browser check:** add a live caption under a photo, swap in another photo — the date and title update; make it static and swap again — it keeps its text.
- **Kit components:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx:158` page `inspector`); `CaptionSection` (`uikit/src/sandbox/inspector.tsx`), live caption block in `TextSection` ("Live from photo metadata" `uikit/src/sandbox/sections.tsx:86`)
- **Demo:** `uikit#/demo` steps 16 `editor-frame-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** captions from photo metadata
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** text-blocks
- **UI kit:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); `CaptionSection` (`uikit/src/sandbox/inspector.tsx`), live caption block in `TextSection` (`uikit/src/sandbox/sections.tsx`)
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
