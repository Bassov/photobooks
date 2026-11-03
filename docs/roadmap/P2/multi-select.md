# multi-select

Tag: feature
Milestone: P2
Title: group operations
Status: done

## Scope

- [ ] Shift+click multi-select, part 1 of the Designer Spec `shared/design/multi-select/spec.md` ("Direction", "Canvas", "Clicks and keys"): a selection set on one spread, Shift+click / Shift+Enter / Shift+Space toggle (never swap), the dashed group box with no handles, Esc clears, Delete / Backspace deletes the set in one undo step "Delete N frames"
- Owner-approved scope change: the Owner brief of 2026-11-03 splits the Spec's prod Item 1 (over the item size limit); group move → `multi-select-move`, marquee → `multi-select-marquee`, align / distribute, arrange and the multi inspector → `multi-select-inspector`. With 2 or more selected the inspector keeps today's empty state.
- **Perf:** Shift+click and the group box draw add no long task (drag-swap frame-budget gates).
- **Browser check:** Shift+click two filled frames: both outlined, no handles, a dashed group box, photos not swapped; Delete removes both, one undo restores them.
- **Kit components:** `uikit#/feature/frame-selection-handles` (`uikit/src/features/pages.tsx` page `frame-selection-handles`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart`); `AlignSection` (`uikit/src/sandbox/inspector.tsx`); page scenario with two frames selected
- **Demo:** `uikit#/demo` steps 16 `editor-frame-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** shift-click multi-select
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-frame-selection, arrange-lock
- **UI kit:** `uikit#/feature/frame-selection-handles` (`uikit/src/features/pages.tsx` page `frame-selection-handles`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart`); `AlignSection` (`uikit/src/sandbox/inspector.tsx`); page scenario with two frames selected
