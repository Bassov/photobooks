# parent-overrides-canvas

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item parent-overrides-canvas
Status: done

## Scope

- [ ] PO1: editor canvas marks every inherited parent item with a 1 px dashed `--parent-soft` outline (constant screen px, `pointer-events:none`); override copies carry no outline; thumbs, Preview and export unchanged
- [ ] PO2: new pure `src/editor/parentHit.ts` (parent guide within 4.5 screen px first, else the topmost rotation-aware parent item under the press, through own frames); Ctrl+Shift or ⌘⇧ primary press on a parent item → `overrideParentFrame` + select the copy, a drag past 3 px continues as the copy's move (own undo step); Alt stays the snap bypass; a plain press over an uncovered parent item keeps today's behaviour and sets the live-region status (no pill)
- [ ] PO3: copies paint in the parent slot (under own frames) as `button.spread-frame[data-override]` with `pointer-events:auto`; badge `unlink2` + "override" with the fit rule (full / icon-only / none); select / move / resize / rotate / lock / photo drop work on copies; z-order moves never apply to copies; Delete on a copy hides the parent item ("Hide parent item")
- **Done when:** `src/render/SpreadView.parent.test.tsx:53` still pins the inert layer for parent items, plus cases for copies (button in the parent layer, `data-override`, badge in the editor, none in thumbs); unit tests for `parentHit.ts`, the badge fit rule and Delete on a copy; new `e2e/parent-overrides.spec.ts` (Ctrl+Shift through an own frame makes a copy and moves it, undo steps, badge fit at 3 sizes by DOM size); `e2e/parent-spreads.spec.ts:89-110` green unchanged; PR body lists spec items done and deviations with reason
- **Browser check:** painter fixture with Master A on every spread: draw a frame over the logo, Ctrl+Shift-press the logo through it and drag → a copy with the override badge moves, the own frame stays; Undo twice → copy back at the parent position, then gone
- **Design SoT:** Designer design `parent-overrides` PO1–PO3 + Decisions (READY 2026-11-04)
- **Hard nos:** no `uikit/`; no inspector files (`Inspector.tsx`, `SpreadSections.tsx`, `FrameSections.tsx`); no guides files (`GuidesOverlay.tsx`, `guideGesture.ts`); no text-frame code; no context menus (PO4) or guide override (PO5)
- **Test:** unit (parentHit, SpreadView parent layer, frameArrange / Delete), e2e `e2e/parent-overrides.spec.ts`
- **Depends:** parent-overrides-core
