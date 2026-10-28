# look-parity-tool-rail

Tag: feature
Milestone: M3
Title: look parity: tool rail in the header
Status: done

## Scope

Look parity, Phase B #1: kit ToolGroup in the header Toolbar.

- [ ] Select · Frame · Text · Hand (V / F / T / H) in a ToggleButtonGroup pill in the header Toolbar (no floating rail)
- [ ] Pill rounded-lg bg-muted p-0.5; toolToggle size-8, muted idle, selected = bg-background + shadow-sm (no ink fill, no blue)
- [ ] Cursors: Frame/Text white mark + thin black outline; Hand grab; Select default; Space still pans and suppresses the canvas outline
- [ ] Crop stays inspector-only; view toggles keep separate bg-accent selected look
- [ ] Tests: tool switching (click, hotkeys) and selected chrome

**Done when:** tool pill switches tools by click and V/F/T/H; selected tool is a raised light pill.
**Browser check:** press F then T then H then V; pill highlight and canvas cursor follow.
**Perf:** no new per-frame work.

## Done note

Header tool group (V/F/T/H), raised selected pill, tool cursors
