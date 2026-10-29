# text-blocks

Tag: feature
Milestone: P2
Title: captions

## Scope

- [ ] Text frames with inline editing; built-in styles (title, caption, body)
- **Perf:** fonts preloaded before first measure; typing re-renders only the edited text frame. Gate: type 200 characters fast — INP ≤ 100 ms.
- **Browser check:** add a caption, edit it inline; it renders the same in the workspace and in spread thumbnails.
- **Kit components:** text frame factory `uikit/src/sandbox/model.ts:70` (`kind:"text"`); Text tool (T) in `ToolGroup` `uikit/src/sandbox/chrome.tsx:106`; in-place edit `uikit/src/sandbox/canvas.tsx:47` `FrameBody` (`editing`, `features.textEdit`), text render `uikit/src/sandbox/canvas.tsx:356-375`; `TextSection` `uikit/src/sandbox/sections.tsx:69` (style, align) mounted at `uikit/src/sandbox/context-inspector.tsx:77`; built-in master parent text frames Running head and Caption band `uikit/src/sandbox/model.ts:72-87`
- **Demo:** `uikit#/demo` editor steps 08–25 show the Text tool in the top bar (not exercised; no capture step); master Running head / Caption band frames render on spreads 14–20
- **Musts:** captions as text frames
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** text-frame-model
- **UI kit:** `uikit/src/sandbox/chrome.tsx` `ToolGroup` Text tool, `uikit/src/sandbox/canvas.tsx` `FrameBody`, `uikit/src/sandbox/sections.tsx` `TextSection`; partial: no capture step
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
