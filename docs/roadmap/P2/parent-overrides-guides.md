# parent-overrides-guides

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item parent-overrides-guides

## Scope

- [ ] PO5: Ctrl+Shift or ⌘⇧ primary press within 4.5 screen px of a parent guide (`parentHit.ts`) → `overrideParentGuide` ("Override parent guide"); the copy paints and behaves as an own guide (solid, draggable, snapping) and the press continues as its drag
- [ ] PO5: dropping an override guide on its ruler or off the spread (own-guide remove rule, `guidesMath.ts`) → `hideParentItem` ("Hide parent item"): copy gone, parent id hidden; moving it elsewhere moves only the copy
- [ ] PO5: hidden parent guides neither paint nor snap
- **Done when:** `e2e/parent-overrides.spec.ts` guide cases (override, drag, drop on ruler hides, snap ignores hidden); `e2e/guides.spec.ts` green unchanged
- **Browser check:** painter fixture with Master A guides: Ctrl+Shift-press a parent guide on a spread and drag it → a solid own-style guide follows, the parent guide is gone on that spread only; drag the copy onto the ruler → no guide there; a frame drag no longer snaps to it
- **Design SoT:** Designer design `parent-overrides` PO5 (READY 2026-11-04)
- **Hard nos:** no `uikit/`; no inspector files (`Inspector.tsx`, `SpreadSections.tsx`, `FrameSections.tsx`); no context menus (PO4, incl. the guide menu "Hide on this spread")
- **Test:** unit (core guide ops on copies, guide drag outcome), e2e `e2e/parent-overrides.spec.ts`
- **Depends:** parent-guides, parent-overrides-canvas
