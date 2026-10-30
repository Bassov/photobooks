# guides

Tag: feature
Milestone: P2
Title: guides
Status: done

## Scope

- [ ] Editor overlay layer above `SpreadView` (editor-only, never in output); guides are its first content
- [ ] Drag from a ruler to create a guide; move, delete
- [ ] Show / hide guides, snap on / off (view state)
- **Perf:** guide drag is a `transform` in rAF, committed at gesture end.
- **Browser check:** pull guides from both rulers, move and delete one, zoom — guides stay aligned with rulers; guides never appear in presentation mode.
- **Kit components:** `uikit/src/sandbox/viewport.tsx:170` `guideDrag` (drag from ruler to create; drag back onto the ruler or off the spread to remove :182-186; lock check :206); `Guide` in `uikit/src/sandbox/model.ts`; snap to guides `view.snapGuides` `uikit/src/sandbox/store.tsx:9`; inherited guides render `uikit/src/sandbox/canvas.tsx:417` (`allGuides`); `ViewToggle "guides"` (Ctrl+;) `uikit/src/sandbox/chrome.tsx:64`; **kit: sandbox, not shown in #/demo** (guide create needs Shift+R)
- **Demo:** `uikit#/demo` steps 14–20 show inherited master guides (dashed, e.g. 16); guide create / move / delete has no step (exposed by P1 `kit10-demo-expose-hidden`)
- **Musts:** drag guides from rulers
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll; guides never in Preview or output
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** rulers
- **UI kit:** partial: `uikit/src/sandbox/viewport.tsx` guide drag, `uikit/src/sandbox/canvas.tsx` guide render; missing: #/demo toolbar toggle and capture step
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
