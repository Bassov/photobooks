# design-r14-hide-framestyle

Tag: feature
Milestone: P1
Title: Bug: /next-roadmap-item design-r14-hide-framestyle

## Scope

- [ ] Photo inspector (`editor-frame-selected`) renders no FRAME STYLE and no ARRANGE section (header, summary, chips, "New style from this frame", z buttons: count 0), behind one switch in `PhotoFrameSections.tsx` (Owner Q8 2026-11-02 = hide, M78 closed as hidden). Model, ops, history and their unit tests stay.
- [ ] Delete frame matches the kit (`uikit/src/sandbox/context-inspector.tsx` `p-4` > `p-3`, `destructive-ghost`): x 1168, w 244, color rgb(57, 55, 56); y follows the shorter section list. ADJUST / CAPTION / POSITION & SIZE keep their M72/M76/M81 values; no doubled divider.
- [ ] e2e `e2e/design-r14-hide-framestyle.spec.ts`; existing specs flip only their FRAME STYLE / ARRANGE assertions to the hidden state.
- **Browser check:** 1440 × 900, select a filled frame: inspector ends ADJUST, CAPTION, POSITION & SIZE, then Delete frame; no Frame style / Arrange rows.
