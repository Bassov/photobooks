## Implementation

- [x] 1. Core `moveGuide` moves a guide in `parentOverrides.guides` (unit tests in `src/core/ops/guides.test.ts`, "moves a parent guide's local copy, never the parent")
- [x] 2. `guideGesture.ts`: ruler lookup helper, a copy dropped on its ruler → `hideParentItem`, `startParentGuideOverride` (flushSync override, then drag the copy's line); unit tests in `src/editor/guideGesture.test.ts` (`startParentGuideOverride (Designer PO5)`)
- [x] 3. `GuidesOverlay.tsx`: copies render as own guides with `data-layer="override"`; unit test "draws an overridden parent guide as an own guide that drags"
- [x] 4. `frameGesture.ts`: a Ctrl/⌘+Shift guide hit starts the override and swallows the release click (`frameGesture.override.test.ts`, "Ctrl+Shift on a parent guide through an own frame overrides the guide (PO5)")
- [x] 5. `loadPainterFixture.ts` `&guides=a` + `e2e/parent-overrides.spec.ts` `parent guides (Designer PO5)` (override + drag, drop on ruler hides, other spread unchanged, snap ignores hidden)

## Manual test scenarios

1. `/?fixture=painter&parent=a&guides=a`, rulers on, spread 3: Ctrl+Shift-drag the dashed Master A horizontal guide down → a solid guide follows; spread 4 still shows the dashed one.
2. Drag that solid guide onto the top ruler → no guide on spread 3; Undo brings the copy back.

manual-qa (2026-11-05):

- 1: problem (harness) — `start-session` click intercepted by the welcome header, scenario not reached; covered by e2e `parent-overrides.spec.ts` "Ctrl+Shift on a parent guide through the frames overrides it on this spread…" (passes locally).
- 2: problem (harness) — same blocker; covered by e2e "a copy dropped on its ruler hides the parent guide on this spread; hidden, it neither paints nor snaps" (passes locally, incl. Undo).
