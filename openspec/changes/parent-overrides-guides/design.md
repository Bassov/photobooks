## Decisions

1. Press routing stays in `frameGesture.ts` `onDown`: a Ctrl/⌘+Shift `parentHitAt` guide hit calls `startParentGuideOverride` (`guideGesture.ts`) and swallows the release click.
2. `startParentGuideOverride` dispatches `overrideParentGuide` in `flushSync` (the copy's line must exist before the drag), then runs `startGuideDrag` on that line; a locked copy only overrides.
3. Copies render through the own-guide branch of `GuidesOverlay` with `data-layer="override"`; on drop `remove` (`guidesMath.ts`, unchanged) the drag looks the id up in `parentOverrides.guides` → `hideParentItem`, else `removeGuide`; `commit` → `moveGuide`. Ruler lookup moves into `guideGesture.ts`.
4. Core `moveGuide` also moves a copy in `parentOverrides.guides`. Hidden ids already leave `viewGuides` (overlay + frame snap), so hidden guides neither paint nor snap.
5. Tokens: existing `--guide` (named in `docs/design.md`); no new tokens.

## Touch-set & Test Plan

| Path                                                                | Why                                  |
| ------------------------------------------------------------------- | ------------------------------------ |
| `src/core/ops/guides.ts`                                            | move copies                          |
| `src/core/ops/guides.test.ts`                                       | unit                                 |
| `src/editor/guideGesture.ts`                                        | override start, hide                 |
| `src/editor/guideGesture.test.ts`                                   | unit                                 |
| `src/editor/GuidesOverlay.tsx`                                      | copy as own guide                    |
| `src/editor/GuidesOverlay.test.tsx`                                 | unit                                 |
| `src/editor/frameGesture.ts`                                        | routing                              |
| `src/editor/frameGesture.override.test.ts`                          | unit                                 |
| `src/testFixtures/loadPainterFixture.ts`                            | `&guides=a` Master A guides          |
| `src/testFixtures/painterFixture.test.ts`                           | unit                                 |
| `e2e/parent-overrides.spec.ts`                                      | empty / happy / drop-on-ruler / snap |
| `openspec/changes/parent-overrides-guides/specs/pasteboard/spec.md` | PO5                                  |

Reuse: `parentHitAt`, `startGuideDrag`, `guideDropOutcome`, `hideParentItem`. `e2e/guides.spec.ts` unchanged. Skill `ui-review` before push.
