# photo-rotate

Tag: feature
Milestone: P2
Title: rotate photos in frames
Status: done

## Scope

- [ ] Rotate 90° left / right and straighten (±45°) inside a frame; cover fit recomputed; keyboard shortcuts
- **Perf:** straighten preview is a `transform` in rAF, committed at gesture end. Gate: straighten drag for 5 s — zero LoAF, `pointermove` p95 ≤ 2 ms.
- **Browser check:** rotate a sideways photo 90° and straighten a tilted horizon; the frame stays covered; reload keeps both.
- **Kit components:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); `PhotoRotateSection` (`uikit/src/sandbox/inspector.tsx`, mounted by `InspectorPart` via `ContextInspector`)
- **Demo:** `uikit#/demo` steps 16 `editor-frame-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** rotation in the inspector Frame section
- **Hard nos:** no rotate handle styles not in the kit
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-inspector-frame-spread, kit10-frame-selection
- **UI kit:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); `PhotoRotateSection` (`uikit/src/sandbox/inspector.tsx`, mounted by `InspectorPart` via `ContextInspector`)
