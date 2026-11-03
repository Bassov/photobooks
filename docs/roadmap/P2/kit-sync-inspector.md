# kit-sync-inspector

Tag: feature
Milestone: P2
Title: Bug: kit sync W3 — inspector head, layout picker, flip icons, page size chevron

## Scope

Kit-only (`uikit/`, `#/demo`): port prod's accepted decisions from the Designer kit-sync Spec items 6, 7, 12, 15 (tracker KS6, KS7, KS12, KS15). Prod is the target; `src/` is untouched.

- [x] KS6 (M54): remove the Hide inspector button from the inspector header (`context-inspector.tsx` InspectorShell, `inspector.tsx` InspectorPanel); the top-bar toggle stays.
- [x] KS7 (Owner 2026-11-02, prod #395 `src/editor/LayoutSection.tsx`): no search field, no "Suggested for N photo" / "All layouts" headings; builtin tiles carry no caption (tooltip + aria-label "Apply layout <name>"; saved templates keep theirs), tile h 69.5; header "LAYOUT · <current name>"; one list by photo count ascending; Two portraits merged into One per page on two-page spreads; 2 columns for spreads, 3 for single pages; hint always under the tiles; Contact sheet row under "Save as template": Columns (3) × Rows (2) number fields + secondary "Contact sheet" button at the right. Tile states (M82) stay.
- [x] KS12 (Q5): Flip H / Flip V icons are prod's glyphs.
- [x] KS15: Book settings Page size select: triangle caret → chevron-down 16 px rgb(83,81,82).
- **Browser check:** `#/demo` spread p1 inspector (Square 20×20 book, prod's 2:1 trim): tile h 69.5, 2 columns; page 1: 3 columns; no tile caption text for builtins; header note "· <layout name>"; hint text present; Contact sheet row (2 number fields 3 / 2 + button); Hide-inspector buttons in the inspector head 0; Book settings Page size chevron 16 px.

## Done when

- DOM numbers above match prod on `#/demo` (±1 px); kit qa assertions pin each item (existing ones updated to the new values, none deleted).
- Demo baselines regenerated for affected steps; kit qa green; repo checks green.
- PR body: before/after numbers per item; tracker ids KS6, KS7, KS12, KS15.

## Hard nos

- No `src/` change; no edits to `uikit/src/sandbox/v7.tsx`, `canvas.tsx`, `viewport.tsx`, `chrome.tsx`, `uikit/src/demo-parts/editor.tsx` (other lanes).
- `uikit/scripts/qa.mjs`: append own assertions, update in place; no deletions.
