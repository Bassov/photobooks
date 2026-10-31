# design-r4-polish

Tag: feature
Milestone: P1
Title: Bug: design-r4-polish: drag hint, canvas-centred tool group, 31 px menu rows, sort dot, floor page-number rule

## Scope

- [ ] M38 (step 17): while a photo frame (selected or not) is dragged, the kit status pill "Drag onto another frame to swap, or onto the filmstrip to take the photo back" shows at the canvas bottom-left (12 px insets, 12 px text, 8 px radius), over other frames and the filmstrip; gone after release. A filled frame's body drag is the photo drag (kit), never a frame move.
- [ ] M39 (M20 reopen): the top-bar tool group centres on the canvas area between the left panel and the inspector (kit 1440: 676), follows panel resizes, and stays put when the inspector closes (kit).
- [ ] M40 (steps 42, 45): book card menu, library and filmstrip sort menus use kit 30.84 px rows (13 px × 1.45 line, 6 px padding) and kit menu heights.
- [ ] M41 (step 45): the current sort choice is the kit 8 px dot (`circle`), not a check; multiple-choice menus keep the check.
- [ ] M42 Designer-accepted deviation (2026-10-31): page numbers hidden when the gap cannot hold 8 px + 11 px label, at rest and mid zoom gesture; otherwise exactly 8 px / 11 px.
- **Done when:** `e2e/design-r4-polish.spec.ts` green with `--repeat-each=30`; changed specs green; full chromium e2e suite and the perf spec green.
- **Browser check:** 1440×900: drop a photo, click it, drag it over another frame and the filmstrip (pill bottom-left); top-bar group centred over the canvas; library sort and book menus with 31 px rows and a dot; zoom to the floor (no page numbers) and back to Fit (8 px / 11 px).
- **UI kit:** `uikit/src/sandbox/chrome.tsx` (`StatusLine` :555, `TopBar` :143-200, `Shell` :636-672), `uikit/src/sandbox/canvas.tsx` (`useDrag` :102-107), `uikit/src/components/ui/menu.tsx` (`MenuItem` :66-105). UI ref: `uikit#/demo` steps 17, 42, 45.
- **Source:** Designer round 4, 2026-10-31 (NOT PASS on prod 5e6e242).
