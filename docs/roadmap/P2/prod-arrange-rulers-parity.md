# prod-arrange-rulers-parity

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item prod-arrange-rulers-parity

## Scope

- [ ] Arrange buttons carry their shortcut the kit way (`uikit/src/sandbox/inspector.tsx:199`): "Send to back (Shift+Ctrl+[)", "Send backward (Ctrl+[)", "Bring forward (Ctrl+])", "Bring to front (Shift+Ctrl+])" as accessible name and tooltip, in every inspector caller (photo frame, multi-selection; shared `ArrangeRow` in `src/editor/FrameSections.tsx`)
- [ ] Ruler cursors match the kit (`uikit/src/sandbox/viewport.tsx:125`): top ruler `s-resize`, left ruler `e-resize` (`src/editor/Rulers.css`)
- [ ] Placing or moving a guide sets the editor status the kit way (`uikit/src/sandbox/viewport.tsx:222`, 0.1 mm rounding): "Vertical guide at N mm (left page|right page)" (page-local mm) / "Horizontal guide at N mm", painted as the kit status pill
- **Browser check:** select a photo frame — hover each Arrange button, the tooltip shows the shortcut; hover the rulers — `s-resize` / `e-resize`; pull a vertical guide onto the right page of a two-page spread — the status pill reads "Vertical guide at N mm (right page)".
- **Hard nos:** no kit edits; no blue / teal; no layout shift or page-level H/V scroll

## Done when

- Unit/DOM tests: each Arrange button's accessible name/title includes its shortcut (photo + multi sections); ruler computed cursor `s-resize` / `e-resize`; a guide drag on a two-page spread shows the status text with the correct page and mm value
- `#/demo` baselines unchanged; typecheck + unit green; full e2e at the end
