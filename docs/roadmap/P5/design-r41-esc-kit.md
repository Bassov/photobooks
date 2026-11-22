# design-r41-esc-kit

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r41-esc-kit

## Scope

Design Round 41 M151 + Round 42 M153 (`agent-loop/design-parity-tracker.md`), kit only; prod is the reference.

- [ ] M151: in the kit `#/demo` editor, Esc with nothing selected (and pick → Esc → Esc) keeps the active spread in the inspector ("Spread · Pages …" header, Layout section) instead of the empty "Select a spread or photo" hint, as prod does (`e2e/inspector-context-paths.spec.ts`). Fix in `uikit/src/sandbox/viewport.tsx`; the M92 precondition in `e2e/kit-editor-canvas.spec.ts` follows the new behaviour; a kit e2e pins it.
- [ ] M153: the Fill book result ("Placed 20 photos · added 9 spreads") paints as the kit status pill (`PILL_STATUS` in `uikit/src/sandbox/chrome.tsx`, prod `isStatusPillVisible` F11), asserted by paint in a kit e2e.
- Lane: kit only (no prod `src/` edits, no `uikit/scripts/qa.mjs` edits); demo baselines re-captured locally (untracked).
- **Browser check:** `#/demo` at 1440×900: Esc with nothing selected and pick → Esc → Esc leave the inspector on the active spread; step `editor-fill-book-done` shows the fill status pill.
