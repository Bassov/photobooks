# parent-overrides-core

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item parent-overrides-core
Status: done

## Scope

- [ ] Pure ops in `src/core/parentSpreads.ts` (+ `src/core/index.ts`), dispatched through `bookStore` with undo labels: `overrideParentFrame` ("Override parent item"), `overrideParentGuide` ("Override parent guide"), `hideParentItem` (frame or guide id; removes its copy; "Hide parent item"), `resetParentItem` (removes copy and hidden id; "Reset to parent"), `resetSpreadToParent` ("Reset spread to parent")
- [ ] Every frame op taking `{spreadId, frameId}` also finds frames in `parentOverrides.frames` (move, resize, rotate, photo, crop, caption, fit, lock); every frame lookup caller listed in the PR
- [ ] Changing a spread's parent (`setSpreadParent`, incl. None) keeps the work: override frames become own frames under the lowest own z (relative order kept, `overridesId` dropped), override guides become own guides, `hiddenIds` dropped; one undo step
- [ ] Hidden parent ids neither resolve nor snap
- [ ] Perf: override / hide / reset re-renders only its spread; parent edits skip suppressed ids
- **Done when:** PBT in `src/core/parentSpreads.test.ts` ≥1000 runs (override→reset = identity; hide hides; parent switch keeps copies as own frames, order kept); bookStore unit tests for dispatch + undo labels; `e2e/parent-spreads-perf.spec.ts` extended (parent used by 40 spreads, 10 override its logo, edit parent → 0 LoAF); `src/render/SpreadView.parent.test.tsx` and `e2e/parent-spreads.spec.ts` green unchanged
- **Browser check:** n/a (no UI; canvas and inspector follow in `parent-overrides-canvas`, `parent-overrides-inspector`)
- **Design SoT:** Designer design `parent-overrides` PO8 + Decisions (READY 2026-11-04)
- **Hard nos:** no UI; no `uikit/`, `src/render/` or `src/editor/` UI files; no text-frame or thumb code
- **Test:** unit + PBT on the pure module, bookStore unit tests, perf gate in `e2e/parent-spreads-perf.spec.ts`
- **Depends:** parent-spreads-schema
