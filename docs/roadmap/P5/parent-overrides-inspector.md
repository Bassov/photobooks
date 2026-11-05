# parent-overrides-inspector

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item parent-overrides-inspector

## Scope

- [ ] PO4: `FrameContextMenu.tsx` resolves the right-click point: own frame button → frame menu; else a parent guide within 4.5 screen px → parent guide menu; else the topmost parent item (`src/editor/parentHit.ts`, through own frames) → parent item menu (`aria-label="Parent item"`, `data-testid="parent-menu"`): `unlink2` "Override on this spread" with "Ctrl+Shift+Click" (Mac "⌘⇧Click") → override + select the copy (guide: override only), `eyeOff` "Hide on this spread" → `hideParentItem`; the frame menu on an override copy is `rotateCcw` "Reset to parent", `eyeOff` "Hide on this spread", separator, Lock (no z rows); new glyph `eyeOff` (lucide `eye-off`) in `src/ui/icons/glyphs.ts`
- [ ] PO6: inspector header of a copy (Photo / Text) adds `inspector-override-meta` "Override · {parent name}" (11 px `SUB`) and a right-end ↺ `inspector-reset-parent` "Reset to parent" (28×28, r8, icon 14, `#535152`, hover `#D7D7D7`, focus-visible 2 px `#3A3839` offset 2); click resets the item and clears the selection (the inspector shows the spread)
- [ ] PO7: `SpreadSections.tsx` Master & spacing, after the sliders: `parent-changes` block "Changed from {parent name}" + "Reset all" (`resetSpreadToParent`), rows `parent-change-row` (icon, name, `· override` / `· hidden`, ↺ `parent-change-reset`) in the Designer order and names; absent (no reserved space) when the spread has no changes
- **Done when:** `FrameContextMenu.test.tsx` covers the copy rows (reset / hide / lock, no z rows) and the parent item and parent guide menus; unit tests for the inspector head and the changes list (names, order, empty → absent); `e2e/parent-overrides.spec.ts`: menu override / hide, reset one row and Reset all restore the parent (DOM checks), inspector unchanged on a spread without changes
- **Browser check:** painter fixture with Master A: right-click the logo → Override on this spread → a selected copy with the badge, the inspector head reads "Override · Master A"; ↺ → copy gone; Hide on this spread → logo gone, the spread inspector lists "Photo frame · hidden"; Reset all → logo back, list gone
- **Design SoT:** Designer design `parent-overrides` PO4, PO6, PO7 (READY 2026-11-04)
- **Hard nos:** no `uikit/`; no canvas / render files (`src/render/`, `ConnectedSpreadView.tsx`); no guides files (`GuidesOverlay.tsx`, `guideGesture.ts`); no page-numbers files (`SpreadView`, `MastersCanvas`, `MasterSection`, `BookSettingsSection`)
- **Test:** unit (`FrameContextMenu.test.tsx`, inspector head, changes list), e2e `e2e/parent-overrides.spec.ts`
- **Depends:** parent-overrides-canvas
