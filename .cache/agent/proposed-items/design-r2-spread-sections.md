# design-r2-spread-sections

Tag: feature
Milestone: P1
Title: Spread inspector sections = kit: Master & spacing, Background, Grid (M2 follow-up)

## Scope

- [ ] Spread inspector section order = rendered `#/demo` (Step 0 of design-r2-layout-picker): Layout, Master & spacing, Background, Grid.
- [ ] Master & spacing: Master A / B / None segmented + Margin / Gap sliders that re-flow the template.
- [ ] Background: spread background swatches.
- [ ] Grid: "Use master" / "Custom" + Show grid toggle; title "Grid" (today "Layout grid").
- **Browser check:** select a spread: section titles read LAYOUT, MASTER & SPACING, BACKGROUND, GRID top to bottom as in `#/demo` step 14.
- **Perf:** slider drags commit through the existing store; no new frame-budget regressions.
- **UI kit:** `uikit/src/sandbox/context-inspector.tsx` (`SpreadPageSection`, `SpreadGridSection`), `uikit/src/sandbox/sections.tsx` (`SpreadBgSection`); UI ref: `uikit#/demo`.
- **Source:** design-r2-layout-picker Step 0 (2026-10-31): the product shows only Layout + Layout grid.
